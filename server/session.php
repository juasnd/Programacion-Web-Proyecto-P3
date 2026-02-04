<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: 0");

$timeout_min = 3;
$timeout = $timeout_min * 60;

function is_api_request() {
    $uri = $_SERVER["REQUEST_URI"] ?? "";
    if (strpos($uri, "/server/api.php") !== false) return true;
    if (isset($_GET["action"])) return true;

    $accept = $_SERVER["HTTP_ACCEPT"] ?? "";
    if (stripos($accept, "application/json") !== false) return true;

    $xrw = $_SERVER["HTTP_X_REQUESTED_WITH"] ?? "";
    if (stripos($xrw, "xmlhttprequest") !== false) return true;

    return false;
}

function end_session_common() {
    $_SESSION = [];

    if (ini_get("session.use_cookies")) {
        $p = session_get_cookie_params();
        setcookie(session_name(), "", time() - 42000, $p["path"], $p["domain"], $p["secure"], $p["httponly"]);
    }
    session_destroy();
}

if (!empty($_SESSION["usuario_id"])) {
    if (isset($_SESSION["last_activity"]) && (time() - (int)$_SESSION["last_activity"] > $timeout)) {
        end_session_common();

        if (is_api_request()) {
            header("Content-Type: application/json; charset=utf-8");
            http_response_code(401);
            echo json_encode(["ok" => false, "error" => "sesión expirada"], JSON_UNESCAPED_UNICODE);
            exit;
        }

        header("Location: ../index.php");
        exit;
    }

    $_SESSION["last_activity"] = time();
}
