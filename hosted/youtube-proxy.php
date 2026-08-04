<?php

declare(strict_types=1);

const MAX_REQUEST_BYTES = 20000;
const MAX_UPSTREAM_BYTES = 5 * 1024 * 1024;
const YOUTUBE_TIMEOUT_SECONDS = 12;
const YOUTUBE_CONNECT_TIMEOUT_SECONDS = 5;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $status, array $payload): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function request_value(array $body, string $key): string
{
    $value = $body[$key] ?? '';
    return is_string($value) ? trim($value) : '';
}

function unicode_length(string $value): int
{
    if (function_exists('mb_strlen')) return mb_strlen($value, 'UTF-8');
    $count = preg_match_all('/./us', $value, $matches);
    return $count === false ? strlen($value) : $count;
}

function validate_same_origin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;

    $originHost = parse_url($origin, PHP_URL_HOST);
    $requestHost = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
    if (!is_string($originHost) || $requestHost === '' || strcasecmp($originHost, $requestHost) !== 0) {
        respond(403, ['error' => 'Diese Anfrage stammt nicht von der Overlay-Domain.']);
    }
}

function client_ip(): string
{
    $remote = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (($remote === '127.0.0.1' || $remote === '::1') && !empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $candidate = trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        if (filter_var($candidate, FILTER_VALIDATE_IP)) return $candidate;
    }
    return $remote;
}

function enforce_rate_limit(string $action): void
{
    $limits = [
        'discover' => 12,
        'status' => 90,
        'continuation' => 40,
        'poll' => 240,
    ];
    $limit = $limits[$action] ?? 30;
    $now = time();
    $instance = substr(hash('sha256', __DIR__), 0, 16);
    $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . "multi-chat-youtube-rate-limit-{$instance}.json";
    $handle = @fopen($path, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        if (is_resource($handle)) fclose($handle);
        return;
    }

    $raw = stream_get_contents($handle);
    $state = json_decode(is_string($raw) ? $raw : '', true);
    if (!is_array($state)) $state = [];

    foreach ($state as $key => $entry) {
        if (!is_array($entry) || (int)($entry['window'] ?? 0) < $now - 120) unset($state[$key]);
    }

    $key = hash('sha256', client_ip() . '|' . $action);
    $entry = $state[$key] ?? ['window' => $now, 'count' => 0];
    if ($now - (int)$entry['window'] >= 60) $entry = ['window' => $now, 'count' => 0];
    $entry['count'] = (int)$entry['count'] + 1;
    $state[$key] = $entry;

    if (count($state) > 2000) $state = array_slice($state, -2000, null, true);
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($state));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);

    if ($entry['count'] > $limit) {
        header('Retry-After: 60');
        respond(429, ['error' => 'Zu viele YouTube-Anfragen. Versuche es in einer Minute erneut.']);
    }
}

function youtube_request(string $url, string $method = 'GET', ?array $payload = null): array
{
    if (!function_exists('curl_init')) {
        respond(500, ['error' => 'Die PHP-cURL-Erweiterung ist auf diesem Server nicht aktiviert.']);
    }

    $buffer = '';
    $overflow = false;
    $curl = curl_init($url);
    $headers = [
        'Accept: application/json,text/html;q=0.9,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.9',
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
    ];

    if ($method === 'POST') {
        $headers[] = 'Content-Type: application/json';
        curl_setopt($curl, CURLOPT_POST, true);
        curl_setopt($curl, CURLOPT_POSTFIELDS, json_encode($payload, JSON_UNESCAPED_SLASHES));
    } else {
        $headers[] = 'Cookie: SOCS=CAI; CONSENT=YES+cb.20210328-17-p0.en+FX+410';
        curl_setopt($curl, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($curl, CURLOPT_MAXREDIRS, 4);
    }

    curl_setopt_array($curl, [
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => YOUTUBE_CONNECT_TIMEOUT_SECONDS,
        CURLOPT_TIMEOUT => YOUTUBE_TIMEOUT_SECONDS,
        CURLOPT_ENCODING => '',
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_WRITEFUNCTION => static function ($curlHandle, string $chunk) use (&$buffer, &$overflow): int {
            if (strlen($buffer) + strlen($chunk) > MAX_UPSTREAM_BYTES) {
                $overflow = true;
                return 0;
            }
            $buffer .= $chunk;
            return strlen($chunk);
        },
    ]);

    $ok = curl_exec($curl);
    $status = (int)curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $effectiveUrl = (string)curl_getinfo($curl, CURLINFO_EFFECTIVE_URL);
    $error = curl_error($curl);
    curl_close($curl);

    if ($overflow) respond(502, ['error' => 'YouTube hat eine zu große Antwort geliefert.']);
    if ($ok === false) {
        error_log('[Multi Chat YouTube] cURL error: ' . $error);
        respond(502, ['error' => 'YouTube konnte momentan nicht erreicht werden.']);
    }

    return ['status' => $status, 'body' => $buffer, 'url' => $effectiveUrl];
}

function extract_client_config(string $html): array
{
    preg_match('/"INNERTUBE_API_KEY"\s*:\s*"([A-Za-z0-9_-]+)"/', $html, $keyMatch);
    preg_match('/"INNERTUBE_CLIENT_VERSION"\s*:\s*"([0-9.]+)"/', $html, $versionMatch);
    preg_match('/"VISITOR_DATA"\s*:\s*"([A-Za-z0-9._~%=-]+)"/', $html, $visitorMatch);

    return [
        'apiKey' => $keyMatch[1] ?? '',
        'clientVersion' => $versionMatch[1] ?? '',
        'visitorData' => $visitorMatch[1] ?? '',
    ];
}

function valid_channel_id(string $value): bool
{
    return preg_match('/^UC[A-Za-z0-9_-]{22}$/', $value) === 1;
}

function valid_video_id(string $value): bool
{
    return preg_match('/^[A-Za-z0-9_-]{11}$/', $value) === 1;
}

function valid_api_key(string $value): bool
{
    return preg_match('/^AIza[A-Za-z0-9_-]{20,60}$/', $value) === 1;
}

function valid_client_version(string $value): bool
{
    return preg_match('/^[0-9.]{5,32}$/', $value) === 1;
}

function valid_visitor_data(string $value): bool
{
    return strlen($value) <= 1024 && preg_match('/^[A-Za-z0-9._~%=-]*$/', $value) === 1;
}

function extract_channel_id(string $html): ?string
{
    $patterns = [
        '/youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})/i',
        '/"channelId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/',
        '/"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/',
    ];
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $html, $match) === 1 && valid_channel_id($match[1])) return $match[1];
    }
    return null;
}

function video_id_from_url(string $url): ?string
{
    $query = parse_url($url, PHP_URL_QUERY);
    if (is_string($query)) {
        parse_str($query, $parameters);
        $videoId = is_string($parameters['v'] ?? null) ? $parameters['v'] : '';
        if (valid_video_id($videoId)) return $videoId;
    }
    if (preg_match('~/(?:live|shorts|embed)/([A-Za-z0-9_-]{11})~', $url, $match) === 1) return $match[1];
    return null;
}

function extract_live_video_id(string $html, string $effectiveUrl): ?string
{
    if (preg_match('/"isUpcoming"\s*:\s*true/', $html) === 1) return null;
    if (preg_match('/"playabilityStatus"\s*:\s*\{\s*"status"\s*:\s*"LIVE_STREAM_OFFLINE"/', $html) === 1) return null;

    $fromUrl = video_id_from_url($effectiveUrl);
    if ($fromUrl !== null) return $fromUrl;

    $urlPatterns = [
        '/<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)["\']/i',
        '/<meta[^>]+property=["\']og:url["\'][^>]+content=["\']([^"\']+)["\']/i',
        '/<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:url["\']/i',
    ];
    foreach ($urlPatterns as $pattern) {
        if (preg_match($pattern, $html, $match) !== 1) continue;
        $candidate = video_id_from_url(html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($candidate !== null) return $candidate;
    }

    if (preg_match('/"videoDetails"\s*:\s*\{[\s\S]{0,2500}?"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"[\s\S]{0,2500}?"isLiveContent"\s*:\s*true/', $html, $match) === 1) {
        return $match[1];
    }
    if (preg_match('/"isLiveContent"\s*:\s*true[\s\S]{0,2500}?"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/', $html, $match) === 1) {
        return $match[1];
    }
    return null;
}

function contains_live_badge(array $value): bool
{
    $json = json_encode($value, JSON_UNESCAPED_SLASHES);
    if (!is_string($json)) return false;
    return str_contains($json, 'THUMBNAIL_OVERLAY_BADGE_STYLE_LIVE')
        || str_contains($json, '"text":"LIVE"')
        || str_contains($json, '"imageName":"LIVE"');
}

function find_live_stream(mixed $node, int $depth = 0): ?array
{
    if (!is_array($node) || $depth > 40) return null;

    $lockup = $node['lockupViewModel'] ?? null;
    if (is_array($lockup)
        && ($lockup['contentType'] ?? '') === 'LOCKUP_CONTENT_TYPE_VIDEO'
        && valid_video_id((string)($lockup['contentId'] ?? ''))
        && contains_live_badge($lockup['contentImage']['thumbnailViewModel']['overlays'] ?? [])) {
        return [
            'videoId' => (string)$lockup['contentId'],
            'title' => (string)($lockup['metadata']['lockupMetadataViewModel']['title']['content'] ?? ''),
        ];
    }

    if (valid_video_id((string)($node['videoId'] ?? ''))
        && is_array($node['thumbnailOverlays'] ?? null)
        && contains_live_badge($node['thumbnailOverlays'])) {
        $title = $node['title']['simpleText'] ?? $node['title']['runs'][0]['text'] ?? '';
        return ['videoId' => (string)$node['videoId'], 'title' => is_string($title) ? $title : ''];
    }

    foreach ($node as $value) {
        if (!is_array($value)) continue;
        $found = find_live_stream($value, $depth + 1);
        if ($found !== null) return $found;
    }
    return null;
}

function innertube_context(string $clientVersion, string $visitorData): array
{
    $context = [
        'client' => [
            'clientName' => 'WEB',
            'clientVersion' => $clientVersion,
            'hl' => 'en',
            'gl' => 'US',
        ],
    ];
    if ($visitorData !== '') $context['visitorData'] = $visitorData;
    return $context;
}

function innertube_post(string $endpoint, string $apiKey, string $clientVersion, string $visitorData, array $extra): array
{
    if (!valid_api_key($apiKey) || !valid_client_version($clientVersion) || !valid_visitor_data($visitorData)) {
        respond(400, ['error' => 'Die temporäre YouTube-Konfiguration ist ungültig.']);
    }

    $payload = array_merge(['context' => innertube_context($clientVersion, $visitorData)], $extra);
    $result = youtube_request('https://www.youtube.com/youtubei/v1/' . $endpoint . '?key=' . rawurlencode($apiKey), 'POST', $payload);
    if ($result['status'] === 429) respond(429, ['error' => 'YouTube begrenzt die Anfragen momentan.']);
    if ($result['status'] < 200 || $result['status'] >= 300) {
        respond(502, ['error' => 'YouTube hat die Anfrage nicht akzeptiert.', 'upstreamStatus' => $result['status']]);
    }

    $data = json_decode($result['body'], true, 512, JSON_BIGINT_AS_STRING);
    if (!is_array($data)) respond(502, ['error' => 'YouTube hat eine ungültige Antwort geliefert.']);
    return $data;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    respond(405, ['error' => 'Nur POST-Anfragen werden unterstützt.']);
}

validate_same_origin();
$contentLength = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > MAX_REQUEST_BYTES) respond(413, ['error' => 'Die Anfrage ist zu groß.']);
$rawBody = file_get_contents('php://input', false, null, 0, MAX_REQUEST_BYTES + 1);
if (!is_string($rawBody) || strlen($rawBody) > MAX_REQUEST_BYTES) respond(413, ['error' => 'Die Anfrage ist zu groß.']);
$body = json_decode($rawBody, true);
if (!is_array($body)) respond(400, ['error' => 'Die Anfrage enthält kein gültiges JSON.']);

$action = request_value($body, 'action');
if (!in_array($action, ['discover', 'status', 'continuation', 'poll'], true)) {
    respond(400, ['error' => 'Unbekannte YouTube-Aktion.']);
}
enforce_rate_limit($action);

if ($action === 'discover') {
    $handle = ltrim(request_value($body, 'handle'), '@');
    $handleLength = unicode_length($handle);
    if ($handleLength < 3 || $handleLength > 50 || preg_match('/^[\p{L}\p{N}._-]+$/u', $handle) !== 1) {
        respond(400, ['error' => 'Der YouTube-Handle ist ungültig.']);
    }

    $page = youtube_request('https://www.youtube.com/@' . rawurlencode($handle) . '/live?hl=en&gl=US');
    if ($page['status'] < 200 || $page['status'] >= 300) respond(404, ['error' => 'Der YouTube-Kanal wurde nicht gefunden.']);

    $client = extract_client_config($page['body']);
    $channelId = extract_channel_id($page['body']);
    if ($channelId === null || !valid_api_key($client['apiKey']) || !valid_client_version($client['clientVersion'])) {
        respond(502, ['error' => 'Die YouTube-Kanaldaten konnten nicht gelesen werden.']);
    }

    $videoId = extract_live_video_id($page['body'], $page['url']);
    $title = '';
    if ($videoId === null) {
        $browse = innertube_post('browse', $client['apiKey'], $client['clientVersion'], $client['visitorData'], [
            'browseId' => $channelId,
            'params' => 'EgdzdHJlYW1z8gYECgJ6AA==',
        ]);
        $live = find_live_stream($browse);
        $videoId = $live['videoId'] ?? null;
        $title = $live['title'] ?? '';
    }

    respond(200, [
        'channelId' => $channelId,
        'videoId' => $videoId,
        'title' => $title,
        'apiKey' => $client['apiKey'],
        'clientVersion' => $client['clientVersion'],
        'visitorData' => $client['visitorData'],
    ]);
}

$apiKey = request_value($body, 'apiKey');
$clientVersion = request_value($body, 'clientVersion');
$visitorData = request_value($body, 'visitorData');

if ($action === 'status') {
    $channelId = request_value($body, 'channelId');
    if (!valid_channel_id($channelId)) respond(400, ['error' => 'Die YouTube-Kanal-ID ist ungültig.']);
    $browse = innertube_post('browse', $apiKey, $clientVersion, $visitorData, [
        'browseId' => $channelId,
        'params' => 'EgdzdHJlYW1z8gYECgJ6AA==',
    ]);
    $live = find_live_stream($browse);
    respond(200, ['videoId' => $live['videoId'] ?? null, 'title' => $live['title'] ?? '']);
}

if ($action === 'continuation') {
    $videoId = request_value($body, 'videoId');
    if (!valid_video_id($videoId)) respond(400, ['error' => 'Die YouTube-Video-ID ist ungültig.']);
    $next = innertube_post('next', $apiKey, $clientVersion, $visitorData, ['videoId' => $videoId]);
    $renderer = $next['contents']['twoColumnWatchNextResults']['conversationBar']['liveChatRenderer'] ?? null;
    $continuation = null;
    if (is_array($renderer)) {
        $entry = $renderer['continuations'][0] ?? [];
        $continuation = $entry['reloadContinuationData']['continuation']
            ?? $entry['timedContinuationData']['continuation']
            ?? null;
    }
    $updatedVisitor = $next['responseContext']['visitorData'] ?? $visitorData;
    respond(200, [
        'continuation' => is_string($continuation) ? $continuation : null,
        'visitorData' => is_string($updatedVisitor) && valid_visitor_data($updatedVisitor) ? $updatedVisitor : $visitorData,
    ]);
}

$continuation = request_value($body, 'continuation');
if ($continuation === '' || strlen($continuation) > 12000 || preg_match('/[\x00-\x1F\x7F]/', $continuation) === 1) {
    respond(400, ['error' => 'Der YouTube-Continuation-Token ist ungültig.']);
}
$poll = innertube_post('live_chat/get_live_chat', $apiKey, $clientVersion, $visitorData, ['continuation' => $continuation]);
$liveChat = $poll['continuationContents']['liveChatContinuation'] ?? null;
$updatedVisitor = $poll['responseContext']['visitorData'] ?? $visitorData;
respond(200, [
    'liveChatContinuation' => is_array($liveChat) ? $liveChat : null,
    'visitorData' => is_string($updatedVisitor) && valid_visitor_data($updatedVisitor) ? $updatedVisitor : $visitorData,
]);
