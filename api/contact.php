<?php
/**
 * Komansu — consultation form endpoint
 * ------------------------------------------------------------
 * Validates the enquiry, appends it to /storage/enquiries.jsonl
 * (web access blocked by storage/.htaccess) and tries to email
 * info@komansu.com via PHP mail(). Returns JSON: { ok: bool, ... }.
 *
 * On XAMPP mail() usually isn't configured. Enquiries are still saved
 * to the log file; set up SMTP (or swap mail() for PHPMailer) for production.
 */
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

const TO_EMAIL = 'info@komansu.com';

function respond(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed']);
}

// Honeypot: bots fill hidden fields. Pretend success.
if (!empty($_POST['website'])) {
    respond(200, ['ok' => true]);
}

$clean = static fn(string $k, int $max): string =>
    mb_substr(trim(preg_replace('/[\r\n\t]+/', ' ', (string)($_POST[$k] ?? ''))), 0, $max);

$data = [
    'first_name'   => $clean('first_name', 80),
    'last_name'    => $clean('last_name', 80),
    'company'      => $clean('company', 120),
    'email'        => $clean('email', 160),
    'phone'        => $clean('phone', 30),
    'service'      => $clean('service', 80),
    'project_type' => $clean('project_type', 80),
    'details'      => mb_substr(trim((string)($_POST['details'] ?? '')), 0, 4000),
];

$errors = [];
if ($data['first_name'] === '') $errors['first_name'] = 'Required';
if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Invalid email';
if ($data['phone'] !== '' && !preg_match('/^[0-9+()\-\s]{7,30}$/', $data['phone'])) $errors['phone'] = 'Invalid phone';
if (mb_strlen($data['details']) < 10) $errors['details'] = 'Too short';
if ($errors) respond(422, ['ok' => false, 'errors' => $errors]);

$record = $data + [
    'received_at' => gmdate('c'),
    'ip'          => $_SERVER['REMOTE_ADDR'] ?? '',
];

$dir = dirname(__DIR__) . '/storage';
if (!is_dir($dir)) @mkdir($dir, 0750, true);
$saved = @file_put_contents($dir . '/enquiries.jsonl', json_encode($record, JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND | LOCK_EX) !== false;

$subject = 'New ELV enquiry — ' . ($data['service'] ?: 'General') . ' — ' . $data['first_name'] . ' ' . $data['last_name'];
$body = '';
foreach ($data as $k => $v) $body .= str_pad(ucwords(str_replace('_', ' ', $k)) . ':', 16) . $v . "\n";
$headers = "From: Komansu Website <no-reply@komansu.com>\r\nReply-To: {$data['email']}\r\nContent-Type: text/plain; charset=UTF-8";
$mailed = function_exists('mail') ? @mail(TO_EMAIL, $subject, $body, $headers) : false;

if (!$saved && !$mailed) {
    respond(500, ['ok' => false, 'error' => 'Could not record enquiry']);
}
respond(200, ['ok' => true, 'mailed' => $mailed]);
