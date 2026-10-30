-- 模拟模板，重复执行时以本文件内容为准
INSERT INTO template (id, title, category, cover_url, description, required_image_count, accepted_mime_types, max_file_size_bytes, sort_order) VALUES
('demo-postcard',   '旅行明信片', '创意图片', '/api/demo/postcard.jpg',   '上传两张旅行照片，模拟生成一张明信片。',   2, 'image/jpeg,image/png', 5242880, 10),
('demo-poster',     '光影海报',   '创意图片', '/api/demo/poster.jpg',     '上传一张主图，模拟生成一张光影海报。',     1, 'image/jpeg,image/png', 5242880, 20),
('demo-collage',    '四格拼贴',   '创意图片', '/api/demo/collage.jpg',    '上传四张图片，模拟生成一张四格拼贴画。',   4, 'image/jpeg,image/png', 5242880, 30),
('demo-avatar',     '霓虹头像',   '人像写真', '/api/demo/avatar.jpg',     '上传一张人像，模拟生成霓虹风格头像。',     1, 'image/jpeg,image/png', 5242880, 40),
('demo-portrait',   '双人合照',   '人像写真', '/api/demo/portrait.jpg',   '上传两张人像，模拟生成一张双人合照。',     2, 'image/jpeg,image/png', 5242880, 50),
('demo-pet-star',   '萌宠星空',   '萌宠乐园', '/api/demo/pet-star.jpg',   '上传一张宠物照片，模拟生成星空主题图。',   1, 'image/jpeg,image/png', 5242880, 60),
('demo-pet-album',  '萌宠相册',   '萌宠乐园', '/api/demo/pet-album.jpg',  '上传三张宠物照片，模拟生成一页相册。',     3, 'image/jpeg,image/png', 5242880, 70),
('demo-festival',   '节日贺卡',   '节日祝福', '/api/demo/festival.jpg',   '上传一张图片，模拟生成一张节日贺卡。',     1, 'image/jpeg,image/png', 5242880, 80),
('demo-new-year',   '新年全家福', '节日祝福', '/api/demo/new-year.jpg',   '上传三张家人照片，模拟生成新年全家福。',   3, 'image/jpeg,image/png', 5242880, 90),
('demo-wedding',    '婚礼请柬',   '节日祝福', '/api/demo/wedding.jpg',    '上传两张照片，模拟生成一张婚礼请柬。',     2, 'image/jpeg,image/png', 5242880, 100),
('demo-landscape',  '风景长卷',   '创意图片', '/api/demo/landscape.jpg',  '上传三张风景照片，模拟生成一幅风景长卷。', 3, 'image/jpeg,image/png', 5242880, 110),
('demo-film',       '胶片回忆',   '人像写真', '/api/demo/film.jpg',       '上传一张照片，模拟生成胶片风格回忆图。',   1, 'image/jpeg,image/png', 5242880, 120)
ON DUPLICATE KEY UPDATE
    title = VALUES(title),
    category = VALUES(category),
    cover_url = VALUES(cover_url),
    description = VALUES(description),
    required_image_count = VALUES(required_image_count),
    accepted_mime_types = VALUES(accepted_mime_types),
    max_file_size_bytes = VALUES(max_file_size_bytes),
    sort_order = VALUES(sort_order);
