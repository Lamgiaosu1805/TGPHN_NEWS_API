// controllers/NewsController.js
const axios = require("axios");
const cheerio = require("cheerio");
const News = require("../models/NewsSchema");

const NewsController = {
    getNewsList: async (req, res) => {
        try {
            const page = Math.max(parseInt(req.query.page) || 1, 1);
            const limit = Math.min(parseInt(req.query.limit) || 30, 50);
            const skip = (page - 1) * limit;

            const { category } = req.query;

            // Điều kiện lọc
            const filter = {
                isActive: true,
            };

            if (category) {
                filter.category = category;
            }

            // Query DB
            const [posts, total] = await Promise.all([
                News.find(filter)
                    .sort({ lastPublishedAt: -1 }) // 🔥 QUAN TRỌNG
                    .skip(skip)
                    .limit(limit)
                    .lean(),

                News.countDocuments(filter),
            ]);

            return res.status(200).json({
                success: true,
                message: "Lấy danh sách tin tức thành công",
                data: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    posts,
                },
            });
        } catch (error) {
            console.error("Lỗi getNewsList:", error);
            return res.status(500).json({
                success: false,
                message: "Lỗi server khi lấy danh sách tin tức",
                error: error.message,
            });
        }
    },
    getFeaturedNews: async (req, res) => {
        try {
            const url = "https://www.tonggiaophanhanoi.org/mobile-app-feeding/";
            const { data: html } = await axios.get(url);
            const $ = cheerio.load(html);

            console.log("Đang lấy dữ liệu từ:", url);

            // Tìm div có id là tin-noi-bat-maf
            const newsContainer = $("#tin-noi-bat-maf");

            if (newsContainer.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy container tin mới nhận",
                });
            }

            console.log("Đã tìm thấy container tin-noi-bat-maf");

            // Lấy TẤT CẢ các elementor-post trong container này
            const posts = [];
            const processedLinks = new Set();

            // Tìm tất cả các article có class "elementor-post" trong container
            newsContainer.find("article.elementor-post").each((index, element) => {
                const postElement = $(element);

                // 1. Lấy tiêu đề
                const titleElement = postElement
                    .find(".elementor-post__title a")
                    .first();
                const title = titleElement.text().trim();

                if (!title) {
                    console.log(`Bài ${index + 1}: Không có tiêu đề, bỏ qua`);
                    return;
                }

                // 2. Lấy link
                const postLink = titleElement.attr("href") || "";

                // Kiểm tra trùng link
                if (processedLinks.has(postLink)) {
                    console.log(`Bài "${title.substring(0, 50)}..." đã tồn tại, bỏ qua`);
                    return;
                }
                processedLinks.add(postLink);

                // 3. Lấy NGÀY và GIỜ RIÊNG BIỆT
                const dateElement = postElement.find(".elementor-post-date").first();
                const dateText = dateElement.text().trim();

                const timeElement = postElement.find(".elementor-post-time").first();
                const timeText = timeElement.text().trim();

                // 4. Lấy HÌNH ẢNH TO NHẤT TỪ SRCSET
                let largestImageUrl = "";
                let largestWidth = 0;

                // Tìm img element trong thumbnail
                const thumbnailImg = postElement
                    .find(".elementor-post__thumbnail img")
                    .first();

                if (thumbnailImg.length > 0) {
                    console.log(
                        `\n=== Xử lý ảnh cho bài ${index + 1}: "${title.substring(0, 50)}..." ===`,
                    );

                    // PHƯƠNG PHÁP QUAN TRỌNG NHẤT: Phân tích srcset để lấy ảnh lớn nhất
                    const srcset = thumbnailImg.attr("srcset");
                    if (srcset) {
                        console.log("📷 Có srcset attribute, đang phân tích...");

                        // Phân tích srcset thành mảng các ảnh
                        const images = parseSrcset(srcset);
                        console.log(`Tìm thấy ${images.length} ảnh trong srcset:`);

                        images.forEach((img, i) => {
                            console.log(
                                `  ${i + 1}. ${img.url.substring(0, 80)}... (${img.width}w)`,
                            );
                        });

                        if (images.length > 0) {
                            // Tìm ảnh có width lớn nhất
                            const largestImage = images.reduce((max, img) =>
                                img.width > max.width ? img : max,
                            );

                            largestImageUrl = largestImage.url;
                            largestWidth = largestImage.width;

                            console.log(`✅ Đã chọn ảnh lớn nhất: ${largestWidth}w`);
                            console.log(`   URL: ${largestImageUrl.substring(0, 100)}...`);

                            // Kiểm tra xem có phải ảnh gốc không (không có -300x200)
                            const isOriginal = !largestImageUrl.match(
                                /-\d+x\d+\.(jpg|jpeg|png|webp)$/i,
                            );
                            console.log(`   Là ảnh gốc: ${isOriginal ? "✓" : "✗"}`);
                        }
                    }

                    // PHƯƠNG PHÁP 2: Nếu không có srcset, thử data-src
                    if (!largestImageUrl) {
                        const dataSrc = thumbnailImg.attr("data-src");
                        if (dataSrc && isValidImageUrl(dataSrc)) {
                            largestImageUrl = dataSrc;
                            console.log(
                                `✅ Lấy từ data-src: ${largestImageUrl.substring(0, 100)}...`,
                            );
                        }
                    }

                    // PHƯƠNG PHÁP 3: Nếu vẫn không có, lấy từ src
                    if (!largestImageUrl) {
                        const src = thumbnailImg.attr("src");
                        if (src && isValidImageUrl(src) && !src.startsWith("data:image")) {
                            largestImageUrl = src;
                            console.log(
                                `✅ Lấy từ src: ${largestImageUrl.substring(0, 100)}...`,
                            );
                        }
                    }

                    // PHƯƠNG PHÁP 4: Nếu vẫn là thumbnail, thử chuyển đổi
                    if (largestImageUrl && largestImageUrl.includes("-300x")) {
                        console.log(
                            `⚠️  Ảnh hiện tại là thumbnail, thử chuyển sang ảnh lớn hơn...`,
                        );

                        // Thử tìm ảnh lớn hơn bằng cách thay đổi kích thước
                        const largerImage = findLargerImageFromThumbnail(
                            largestImageUrl,
                            srcset,
                        );
                        if (largerImage) {
                            largestImageUrl = largerImage;
                            console.log(
                                `✅ Đã tìm thấy ảnh lớn hơn: ${largerImage.substring(0, 100)}...`,
                            );
                        }
                    }
                }

                // Chuyển URL relative thành absolute nếu cần
                if (largestImageUrl) {
                    largestImageUrl = convertToAbsoluteUrl(largestImageUrl, url);
                    console.log(
                        `🔗 URL cuối cùng: ${largestImageUrl.substring(0, 120)}...`,
                    );
                } else {
                    console.log("❌ Không tìm thấy hình ảnh");
                }

                // 5. Lấy mô tả
                const excerptElement = postElement
                    .find(".elementor-post__excerpt p")
                    .first();
                const excerpt = excerptElement.text().trim();

                // 6. Lấy danh mục
                const badgeElement = postElement.find(".elementor-post__badge").first();
                const category = badgeElement.text().trim();

                // 7. Lấy post ID
                const articleClasses = postElement.attr("class") || "";
                let postId = "";
                const postIdMatch = articleClasses.match(/post-(\d+)/);
                if (postIdMatch) {
                    postId = postIdMatch[1];
                }

                // Ghép ngày và giờ
                const fullDateTime = `${dateText} ${timeText}`.trim();

                posts.push({
                    id: posts.length + 1,
                    postId: postId,
                    title: title,
                    category: category,
                    excerpt: excerpt,
                    link: postLink,
                    date: dateText,
                    time: timeText,
                    dateTime: fullDateTime,
                    image: largestImageUrl,
                    imageWidth: largestWidth,
                    isLargestImage: true,
                    elementType: "elementor-post",
                });
            });

            console.log(`\n📊 TỔNG KẾT: Đã tìm thấy ${posts.length} bài viết`);

            // Xử lý và format lại thời gian
            const processedPosts = posts.map((post) => {
                // Parse ngày tháng
                let dateObj = null;
                let formattedDate = "";
                let hasTime = false;

                if (post.date) {
                    try {
                        // Parse định dạng dd/mm/yyyy
                        const dateParts = post.date.split("/");
                        if (dateParts.length === 3) {
                            const [day, month, year] = dateParts;
                            dateObj = new Date(year, month - 1, day);

                            // Thêm giờ nếu có
                            if (post.time) {
                                const timeMatch = post.time.match(/(\d{1,2}):(\d{2})/);
                                if (timeMatch) {
                                    const [_, hours, minutes] = timeMatch;
                                    let hour24 = parseInt(hours);

                                    // Xử lý sáng/chiều
                                    if (post.time.includes("chiều") && hour24 < 12) {
                                        hour24 += 12;
                                    } else if (post.time.includes("sáng") && hour24 === 12) {
                                        hour24 = 0;
                                    } else if (post.time.includes("tối") && hour24 < 12) {
                                        hour24 += 12;
                                    }

                                    dateObj.setHours(hour24, parseInt(minutes), 0);
                                    hasTime = true;
                                }
                            }

                            // Format lại
                            const options = {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                                weekday: "long",
                            };

                            if (hasTime) {
                                options.hour = "2-digit";
                                options.minute = "2-digit";
                                options.hour12 = true;
                            }

                            formattedDate = dateObj.toLocaleDateString("vi-VN", options);
                        }
                    } catch (error) {
                        console.log(`Lỗi parse date: ${post.date}`, error);
                    }
                }

                return {
                    ...post,
                    parsedDate: dateObj ? dateObj.toISOString() : null,
                    formattedDateTime: formattedDate || post.dateTime,
                    hasTime: hasTime,
                    timestamp: dateObj ? dateObj.getTime() : null,
                };
            });

            // Thống kê hình ảnh
            const imageStats = {
                total: processedPosts.length,
                hasImage: processedPosts.filter((p) => p.image).length,
                averageWidth:
                    Math.round(
                        processedPosts
                            .filter((p) => p.imageWidth)
                            .reduce((sum, p) => sum + p.imageWidth, 0) /
                        processedPosts.filter((p) => p.imageWidth).length,
                    ) || 0,
                imagesByWidth: {
                    small: processedPosts.filter(
                        (p) => p.imageWidth && p.imageWidth < 500,
                    ).length,
                    medium: processedPosts.filter(
                        (p) => p.imageWidth && p.imageWidth >= 500 && p.imageWidth < 1000,
                    ).length,
                    large: processedPosts.filter(
                        (p) => p.imageWidth && p.imageWidth >= 1000,
                    ).length,
                },
            };

            console.log("\n📈 THỐNG KÊ HÌNH ẢNH");
            console.log(`Tổng bài viết: ${imageStats.total}`);
            console.log(`Có hình ảnh: ${imageStats.hasImage}`);
            console.log(`Chiều rộng trung bình: ${imageStats.averageWidth}px`);
            console.log(`Ảnh nhỏ (<500px): ${imageStats.imagesByWidth.small}`);
            console.log(
                `Ảnh trung bình (500-999px): ${imageStats.imagesByWidth.medium}`,
            );
            console.log(`Ảnh lớn (≥1000px): ${imageStats.imagesByWidth.large}`);

            // Kiểm tra một vài ảnh đầu tiên
            console.log("\n🔍 KIỂM TRA ẢNH (3 bài đầu)");
            processedPosts.slice(0, 3).forEach((post, i) => {
                console.log(`${i + 1}. "${post.title.substring(0, 50)}..."`);
                console.log(
                    `   Ảnh: ${post.image ? post.image.substring(0, 100) + "..." : "Không có"}`,
                );
                console.log(
                    `   Width: ${post.imageWidth ? post.imageWidth + "px" : "Không xác định"}`,
                );
            });

            return res.status(200).json({
                success: true,
                message: `Đã lấy thành công ${processedPosts.length} bài viết từ tin-noi-bat-maf`,
                stats: {
                    posts: processedPosts.length,
                    images: imageStats,
                },
                data: {
                    count: processedPosts.length,
                    posts: processedPosts,
                    containerInfo: {
                        id: "tin-noi-bat-maf",
                        found: newsContainer.length > 0,
                        totalPosts: posts.length,
                    },
                    source: url,
                    fetchedAt: new Date().toISOString(),
                    note: "Ảnh đã được ưu tiên lấy ảnh có width lớn nhất từ srcset",
                },
            });
        } catch (error) {
            console.error("Lỗi khi lấy tin tức:", error);
            return res.status(500).json({
                success: false,
                message: "Lỗi server khi lấy tin tức",
                error: error.message,
            });
        }
    },

    // Debug chi tiết srcset
    debugSrcset: async (req, res) => {
        try {
            const url = "https://www.tonggiaophanhanoi.org/mobile-app-feeding/";
            const { data: html } = await axios.get(url);
            const $ = cheerio.load(html);

            const newsContainer = $("#tin-noi-bat-maf");

            if (newsContainer.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Không tìm thấy container tin-noi-bat-maf",
                });
            }

            const srcsetAnalysis = [];

            // Duyệt qua tất cả bài viết
            newsContainer.find("article.elementor-post").each((index, element) => {
                const postElement = $(element);
                const title = postElement
                    .find(".elementor-post__title a")
                    .first()
                    .text()
                    .trim();

                // Tìm img trong thumbnail
                const thumbnailImg = postElement
                    .find(".elementor-post__thumbnail img")
                    .first();

                if (thumbnailImg.length > 0) {
                    const srcset = thumbnailImg.attr("srcset") || "";
                    const images = parseSrcset(srcset);

                    const analysis = {
                        postIndex: index + 1,
                        postTitle: title.substring(0, 100),
                        hasSrcset: !!srcset,
                        srcset: srcset,
                        images: images,
                        totalImages: images.length,
                        largestImage:
                            images.length > 0
                                ? images.reduce((max, img) =>
                                    img.width > max.width ? img : max,
                                )
                                : null,
                        smallestImage:
                            images.length > 0
                                ? images.reduce((min, img) =>
                                    img.width < min.width ? img : min,
                                )
                                : null,
                        originalImages: images.filter(
                            (img) => !img.url.match(/-\d+x\d+\./),
                        ),
                        thumbnailImages: images.filter((img) =>
                            img.url.match(/-\d+x\d+\./),
                        ),
                    };

                    srcsetAnalysis.push(analysis);
                }
            });

            // Tính tổng kết
            const summary = {
                totalPosts: srcsetAnalysis.length,
                postsWithSrcset: srcsetAnalysis.filter((a) => a.hasSrcset).length,
                averageImagesPerSrcset:
                    srcsetAnalysis.length > 0
                        ? Math.round(
                            srcsetAnalysis.reduce((sum, a) => sum + a.totalImages, 0) /
                            srcsetAnalysis.length,
                        )
                        : 0,
                maxWidthFound: Math.max(
                    ...srcsetAnalysis.map((a) =>
                        a.largestImage ? a.largestImage.width : 0,
                    ),
                ),
                postsWithOriginal: srcsetAnalysis.filter(
                    (a) => a.originalImages.length > 0,
                ).length,
            };

            return res.status(200).json({
                success: true,
                data: {
                    analysis: srcsetAnalysis,
                    summary: summary,
                    examples: srcsetAnalysis.slice(0, 3).map((a) => ({
                        title: a.postTitle,
                        images: a.images.map((img) => ({
                            url: img.url.substring(0, 100) + "...",
                            width: img.width,
                        })),
                    })),
                },
            });
        } catch (error) {
            console.error("Lỗi debug srcset:", error);
            return res.status(500).json({
                success: false,
                message: "Lỗi khi debug srcset",
                error: error.message,
            });
        }
    },
};

// Hàm helper: Parse srcset string thành mảng các ảnh
function parseSrcset(srcset) {
    if (!srcset) return [];

    const images = [];
    const items = srcset
        .split(",")
        .map((item) => item.trim())
        .filter((item) => item);

    for (const item of items) {
        const parts = item.split(" ");
        if (parts.length >= 1) {
            const url = parts[0];

            // Tìm width (300w) hoặc pixel density (2x)
            let width = 0;
            for (let i = 1; i < parts.length; i++) {
                if (parts[i].endsWith("w")) {
                    width = parseInt(parts[i]) || 0;
                    break;
                } else if (parts[i].endsWith("x")) {
                    // Nếu là pixel density, ước tính width
                    const density = parseFloat(parts[i]) || 1;
                    width = Math.round(300 * density); // Giả sử base là 300px
                }
            }

            // Ước tính width từ tên file nếu không có trong srcset
            if (width === 0) {
                const sizeMatch = url.match(/-(\d+)x(\d+)\./);
                if (sizeMatch) {
                    width = parseInt(sizeMatch[1]);
                }
            }

            images.push({
                url: url,
                width: width,
                isThumbnail: url.match(/-\d+x\d+\.(jpg|jpeg|png|webp)$/i)
                    ? true
                    : false,
            });
        }
    }

    return images;
}

// Hàm helper: Tìm ảnh lớn hơn từ thumbnail URL
function findLargerImageFromThumbnail(thumbnailUrl, srcset) {
    if (!thumbnailUrl) return null;

    // Nếu có srcset, tìm ảnh lớn nhất
    if (srcset) {
        const images = parseSrcset(srcset);
        if (images.length > 0) {
            const largest = images.reduce((max, img) =>
                img.width > max.width ? img : max,
            );
            return largest.url;
        }
    }

    // Thử chuyển đổi thumbnail URL thành ảnh lớn hơn
    // Pattern: /image-300x200.jpg → /image.jpg hoặc /image-800x533.jpg
    const originalUrl = thumbnailUrl.replace(
        /-\d+x\d+(?=\.(jpg|jpeg|png|webp)$)/i,
        "",
    );

    // Nếu URL thay đổi, có thể là ảnh gốc
    if (originalUrl !== thumbnailUrl) {
        return originalUrl;
    }

    return thumbnailUrl;
}

// Hàm helper: Kiểm tra URL hình ảnh hợp lệ
function isValidImageUrl(url) {
    if (!url) return false;
    if (url.startsWith("data:image")) return false;

    const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
    return imageExtensions.some((ext) => url.toLowerCase().includes(ext));
}

// Hàm helper: Chuyển URL relative thành absolute
function convertToAbsoluteUrl(imageUrl, baseUrl) {
    if (!imageUrl) return "";

    if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
        return imageUrl;
    }

    if (imageUrl.startsWith("//")) {
        return "https:" + imageUrl;
    }

    if (imageUrl.startsWith("/")) {
        const base = new URL(baseUrl);
        return base.origin + imageUrl;
    }

    try {
        return new URL(imageUrl, baseUrl).href;
    } catch (error) {
        return imageUrl;
    }
}

module.exports = NewsController;
