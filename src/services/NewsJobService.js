// services/NewsJobService.js
const axios = require("axios");
const cheerio = require("cheerio");
const News = require("../models/NewsSchema");

class NewsJobService {
    constructor() {
        this.sourceUrl = "https://www.tonggiaophanhanoi.org/mobile-app-feeding/";
        this.lastCheckTime = null;
        this.stats = {
            totalFetched: 0,
            totalSaved: 0,
            lastRun: null,
        };
    }

    // Hàm chính để chạy job
    async runJob() {
        try {
            console.log(`[${new Date().toISOString()}] Bắt đầu quét tin tức...`);

            // 1. Lấy tin tức từ website
            const posts = await this.fetchNewsFromWebsite();
            console.log(`Tìm thấy ${posts.length} bài viết từ website`);

            // 2. Xử lý và lưu vào database
            const result = await this.processAndSavePosts(posts);

            // Cập nhật stats
            this.stats.totalFetched += posts.length;
            this.stats.totalSaved += result.new + result.updated;
            this.stats.lastRun = new Date();
            this.lastCheckTime = new Date();

            console.log(
                `[${new Date().toISOString()}] Hoàn thành job: ${result.new} bài mới, ${result.updated} bài cập nhật`,
            );

            return result;
        } catch (error) {
            console.error("Lỗi khi chạy job:", error);
            throw error;
        }
    }

    // Lấy tin tức từ website - DÙNG CÙNG LOGIC VỚI CONTROLLER
    async fetchNewsFromWebsite() {
        try {
            const { data: html } = await axios.get(this.sourceUrl);
            const $ = cheerio.load(html);

            const newsContainer = $("#tin-moi-nhan-maf");

            if (newsContainer.length === 0) {
                console.log("Không tìm thấy container tin-moi-nhan-maf");
                return [];
            }

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

                // 4. Lấy HÌNH ẢNH TO NHẤT TỪ SRCSET - QUAN TRỌNG
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
                        const images = this.parseSrcset(srcset);
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
                        if (dataSrc && this.isValidImageUrl(dataSrc)) {
                            largestImageUrl = dataSrc;
                            console.log(
                                `✅ Lấy từ data-src: ${largestImageUrl.substring(0, 100)}...`,
                            );
                        }
                    }

                    // PHƯƠNG PHÁP 3: Nếu vẫn không có, lấy từ src
                    if (!largestImageUrl) {
                        const src = thumbnailImg.attr("src");
                        if (
                            src &&
                            this.isValidImageUrl(src) &&
                            !src.startsWith("data:image")
                        ) {
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
                        const largerImage = this.findLargerImageFromThumbnail(
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
                    largestImageUrl = this.convertToAbsoluteUrl(
                        largestImageUrl,
                        this.sourceUrl,
                    );
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

                // 8. Parse ngày giờ thành Date object
                const parsedDate = this.parseDateTime(dateText, timeText);

                posts.push({
                    postId: postId,
                    title: title,
                    category: category,
                    excerpt: excerpt,
                    link: postLink,
                    date: dateText,
                    time: timeText,
                    dateTime: `${dateText} ${timeText}`.trim(),
                    image: largestImageUrl,
                    imageWidth: largestWidth,
                    isLargestImage: true,
                    elementType: "elementor-post",
                    parsedDate: parsedDate,
                    timestamp: parsedDate.getTime(),
                    hasTime: timeText.includes(":"),
                    formattedDateTime: this.formatDateTime(parsedDate, timeText),
                });
            });

            console.log(`\n📊 TỔNG KẾT: Đã tìm thấy ${posts.length} bài viết`);

            // Thống kê hình ảnh
            const imageStats = {
                total: posts.length,
                hasImage: posts.filter((p) => p.image).length,
                averageWidth:
                    Math.round(
                        posts
                            .filter((p) => p.imageWidth)
                            .reduce((sum, p) => sum + p.imageWidth, 0) /
                        posts.filter((p) => p.imageWidth).length,
                    ) || 0,
            };

            console.log(`Có hình ảnh: ${imageStats.hasImage}`);
            console.log(`Chiều rộng trung bình: ${imageStats.averageWidth}px`);

            return posts;
        } catch (error) {
            console.error("Lỗi khi lấy tin từ website:", error);
            throw error;
        }
    }

    // Xử lý và lưu bài viết vào database
    async processAndSavePosts(posts) {
        let newCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        for (const postData of posts) {
            try {
                // Tìm bài viết đã tồn tại trong DB
                const existingPost = await News.findOne({ postId: postData.postId });

                if (!existingPost) {
                    // Bài viết mới - thêm vào DB
                    const newPost = new News({
                        ...postData,
                        originalPublishedAt: postData.parsedDate,
                        lastPublishedAt: postData.parsedDate,
                    });

                    await newPost.save();
                    newCount++;
                    console.log(
                        `✓ Thêm mới: ${postData.title.substring(0, 50)}... (Ảnh: ${postData.imageWidth}px)`,
                    );
                } else {
                    // Bài viết đã tồn tại - kiểm tra có cần cập nhật không
                    const shouldUpdate = await this.shouldUpdatePost(
                        existingPost,
                        postData,
                    );

                    if (shouldUpdate) {
                        // Cập nhật bài viết
                        existingPost.title = postData.title;
                        existingPost.category = postData.category;
                        existingPost.excerpt = postData.excerpt;
                        existingPost.date = postData.date;
                        existingPost.time = postData.time;
                        existingPost.dateTime = postData.dateTime;
                        existingPost.image = postData.image;
                        existingPost.imageWidth = postData.imageWidth;
                        existingPost.parsedDate = postData.parsedDate;
                        existingPost.formattedDateTime = postData.formattedDateTime;
                        existingPost.timestamp = postData.timestamp;
                        existingPost.hasTime = postData.hasTime;

                        // Nếu thời gian đăng khác (bài được đăng lại)
                        if (
                            existingPost.parsedDate.getTime() !==
                            postData.parsedDate.getTime()
                        ) {
                            existingPost.lastPublishedAt = postData.parsedDate;
                            existingPost.isRepublished = true;
                            existingPost.republishCount =
                                (existingPost.republishCount || 0) + 1;
                            console.log(
                                `↻ Cập nhật (re-publish): ${postData.title.substring(0, 50)}... (Ảnh: ${postData.imageWidth}px)`,
                            );
                        } else {
                            console.log(
                                `↺ Cập nhật thông tin: ${postData.title.substring(0, 50)}... (Ảnh: ${postData.imageWidth}px)`,
                            );
                        }

                        await existingPost.save();
                        updatedCount++;
                    } else {
                        skippedCount++;
                    }
                }
            } catch (error) {
                console.error(`Lỗi xử lý bài ${postData.postId}:`, error.message);
            }
        }

        return {
            new: newCount,
            updated: updatedCount,
            skipped: skippedCount,
            total: posts.length,
        };
    }

    // Kiểm tra có nên cập nhật bài viết không
    async shouldUpdatePost(existingPost, newPostData) {
        // 1. Kiểm tra nếu thời gian đăng khác nhau
        const hasDifferentTime =
            existingPost.parsedDate.getTime() !== newPostData.parsedDate.getTime();

        // 2. Kiểm tra nếu có thông tin thay đổi quan trọng
        const hasChangedContent =
            existingPost.title !== newPostData.title ||
            existingPost.category !== newPostData.category ||
            existingPost.excerpt !== newPostData.excerpt ||
            existingPost.image !== newPostData.image ||
            existingPost.imageWidth !== newPostData.imageWidth;

        // 3. Nếu thời gian khác nhau HOẶC có thay đổi nội dung HOẶC ảnh nhỏ hơn
        const hasSmallerImage = existingPost.imageWidth < newPostData.imageWidth;

        return hasDifferentTime || hasChangedContent || hasSmallerImage;
    }

    // ========== HELPER METHODS (GIỐNG CONTROLLER) ==========

    // Parse srcset string thành mảng các ảnh
    parseSrcset(srcset) {
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

    // Tìm ảnh lớn hơn từ thumbnail URL
    findLargerImageFromThumbnail(thumbnailUrl, srcset) {
        if (!thumbnailUrl) return null;

        // Nếu có srcset, tìm ảnh lớn nhất
        if (srcset) {
            const images = this.parseSrcset(srcset);
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

    // Kiểm tra URL hình ảnh hợp lệ
    isValidImageUrl(url) {
        if (!url) return false;
        if (url.startsWith("data:image")) return false;

        const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
        return imageExtensions.some((ext) => url.toLowerCase().includes(ext));
    }

    // Chuyển URL relative thành absolute
    convertToAbsoluteUrl(imageUrl, baseUrl) {
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

    // Parse date time
    parseDateTime(dateStr, timeStr) {
        try {
            const dateParts = dateStr.split("/");
            if (dateParts.length === 3) {
                const [day, month, year] = dateParts;
                const date = new Date(year, month - 1, day);

                if (timeStr) {
                    const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
                    if (timeMatch) {
                        let [_, hours, minutes] = timeMatch;
                        let hour24 = parseInt(hours);

                        if (timeStr.includes("chiều") && hour24 < 12) hour24 += 12;
                        else if (timeStr.includes("sáng") && hour24 === 12) hour24 = 0;
                        else if (timeStr.includes("tối") && hour24 < 12) hour24 += 12;

                        date.setHours(hour24, parseInt(minutes), 0);
                    }
                }

                return date;
            }
        } catch (error) {
            console.log("Lỗi parse date:", error);
        }

        return new Date();
    }

    // Format date time
    formatDateTime(dateObj, timeStr) {
        const options = {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
        };

        if (timeStr && timeStr.includes(":")) {
            options.hour = "2-digit";
            options.minute = "2-digit";
            options.hour12 = true;
        }

        return dateObj.toLocaleDateString("vi-VN", options);
    }
}

module.exports = new NewsJobService();
