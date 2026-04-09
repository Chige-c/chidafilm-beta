<?php
// JSONデータを受け取る設定
header('Content-Type: application/json');
$data = file_get_contents('php://input');

// データが空、または不正な場合はエラーを返す
if (json_decode($data) === null) {
    http_response_code(400);
    echo json_encode(["status" => "error", "message" => "不正なデータです"]);
    exit;
}

// 保存先のフォルダとファイル名
$dir = 'data';
$file_path = $dir . '/vod_cache.json';

// dataフォルダが存在しない場合は自動で作成する
if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}

// ファイルに書き込む
if (file_put_contents($file_path, $data)) {
    echo json_encode(["status" => "success"]);
} else {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "ファイルの書き込みに失敗しました。dataフォルダの権限を確認してください。"]);
}
?>