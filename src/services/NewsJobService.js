const axios = require("axios");
const cheerio = require("cheerio");
const NewsSchema = require("../models/NewsSchema");

class NewsJobService {
    constructor() {
        this.sourceUrl = "https://www.tonggiaophanhanoi.org/mobile-app-feeding/";
        this.lastCheckTime = null;
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

            console.log(
                `[${new Date().toISOString()}] Hoàn thành job: ${result.new} bài mới, ${result.updated} bài cập nhật`,
            );
            this.lastCheckTime = new Date();

            return result;
        } catch (error) {
            console.error("Lỗi khi chạy job:", error);
            throw error;
        }
    }

    // Lấy tin tức từ website
    async fetchNewsFromWebsite() {
        try {
            const { data: html } = await axios.get(this.sourceUrl);
            const $ = cheerio.load(html);

            // Tìm div có id là tin-moi-nhan-maf
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

                if (!title) return;

                // 2. Lấy link
                const postLink = titleElement.attr("href") || "";

                // Kiểm tra trùng link
                if (processedLinks.has(postLink)) return;
                processedLinks.add(postLink);

                // 3. Lấy NGÀY và GIỜ
                const dateElement = postElement.find(".elementor-post-date").first();
                const dateText = dateElement.text().trim();

                const timeElement = postElement.find(".elementor-post-time").first();
                const timeText = timeElement.text().trim();

                // 4. Lấy HÌNH ẢNH LỚN NHẤT
                let largestImageUrl = "";
                let largestWidth = 0;

                const thumbnailImg = postElement
                    .find(".elementor-post__thumbnail img")
                    .first();

                if (thumbnailImg.length > 0) {
                    // Phân tích srcset để lấy ảnh lớn nhất
                    const srcset = thumbnailImg.attr("srcset");
                    if (srcset) {
                        const images = this.parseSrcset(srcset);
                        if (images.length > 0) {
                            const largestImage = images.reduce((max, img) =>
                                img.width > max.width ? img : max,
                            );
                            largestImageUrl = largestImage.url;
                            largestWidth = largestImage.width;
                        }
                    }

                    // Nếu không có srcset, thử data-src
                    if (!largestImageUrl) {
                        const dataSrc = thumbnailImg.attr("data-src");
                        if (dataSrc && this.isValidImageUrl(dataSrc)) {
                            largestImageUrl = dataSrc;
                        }
                    }

                    // Nếu vẫn không có, lấy từ src
                    if (!largestImageUrl) {
                        const src = thumbnailImg.attr("src");
                        if (
                            src &&
                            this.isValidImageUrl(src) &&
                            !src.startsWith("data:image")
                        ) {
                            largestImageUrl = src;
                        }
                    }
                }

                // Chuyển URL relative thành absolute
                if (largestImageUrl) {
                    largestImageUrl = this.convertToAbsoluteUrl(
                        largestImageUrl,
                        this.sourceUrl,
                    );
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
                    formattedDateTime: parsedDate.toLocaleDateString("vi-VN", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        weekday: "long",
                        hour: timeText.includes(":") ? "2-digit" : undefined,
                        minute: timeText.includes(":") ? "2-digit" : undefined,
                        hour12: true,
                    }),
                });
            });

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
                const existingPost = await NewsSchema.findOne({
                    postId: postData.postId,
                });

                if (!existingPost) {
                    // Bài viết mới - thêm vào DB
                    const newPost = new NewsSchema({
                        ...postData,
                        originalPublishedAt: postData.parsedDate,
                        lastPublishedAt: postData.parsedDate,
                    });

                    await newPost.save();
                    newCount++;
                    console.log(`✓ Thêm mới: ${postData.title.substring(0, 50)}...`);
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
                                `↻ Cập nhật (re-publish): ${postData.title.substring(0, 50)}...`,
                            );
                        } else {
                            console.log(
                                `↺ Cập nhật thông tin: ${postData.title.substring(0, 50)}...`,
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
            existingPost.image !== newPostData.image;

        // 3. Nếu thời gian khác nhau HOẶC có thay đổi nội dung
        return hasDifferentTime || hasChangedContent;
    }

    // Các hàm helper
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
                let width = 0;

                for (let i = 1; i < parts.length; i++) {
                    if (parts[i].endsWith("w")) {
                        width = parseInt(parts[i]) || 0;
                        break;
                    }
                }

                if (width === 0) {
                    const sizeMatch = url.match(/-(\d+)x(\d+)\./);
                    if (sizeMatch) width = parseInt(sizeMatch[1]);
                }

                images.push({ url, width });
            }
        }

        return images;
    }

    isValidImageUrl(url) {
        if (!url || url.startsWith("data:image")) return false;
        const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
        return imageExtensions.some((ext) => url.toLowerCase().includes(ext));
    }

    convertToAbsoluteUrl(imageUrl, baseUrl) {
        if (!imageUrl) return "";
        if (imageUrl.startsWith("http")) return imageUrl;
        if (imageUrl.startsWith("//")) return "https:" + imageUrl;
        if (imageUrl.startsWith("/")) {
            const base = new URL(baseUrl);
            return base.origin + imageUrl;
        }
        try {
            return new URL(imageUrl, baseUrl).href;
        } catch {
            return imageUrl;
        }
    }

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
}

module.exports = new NewsJobService();
