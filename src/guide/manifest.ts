/**
 * Cây mục lục của trang Hướng dẫn sử dụng (/guide).
 * Nguồn duy nhất cho: thứ tự mục lục, Trước / Tiếp theo, breadcrumb, tìm kiếm.
 * Mỗi trang tương ứng một file: src/guide/<locale>/<group>/<page>.md
 */
export interface GuidePage {
    slug: string;
    title: string;
}

export interface GuideGroup {
    slug: string;
    title: string;
    pages: GuidePage[];
}

export interface GuideEntry {
    group: GuideGroup;
    page: GuidePage;
    /** "group/page" */
    path: string;
}

/** Ngày cập nhật nội dung hướng dẫn gần nhất (hiển thị cuối mục lục) */
export const GUIDE_UPDATED = "22/10/2026";

export const GUIDE: GuideGroup[] = [
    {
        slug: "getting-started",
        title: "Bắt đầu",
        pages: [
            { slug: "intro", title: "Giới thiệu AIQuizzizz" },
            { slug: "account", title: "Đăng ký & đăng nhập" },
            { slug: "forgot-password", title: "Quên mật khẩu" },
            { slug: "navigation", title: "Giao diện chính" },
        ],
    },
    {
        slug: "question-sets",
        title: "Bộ câu hỏi",
        pages: [
            { slug: "create", title: "Tạo bộ câu hỏi" },
            { slug: "question-types", title: "Các loại câu hỏi" },
            { slug: "markdown", title: "Rich text & Markdown" },
            { slug: "media", title: "Ảnh / video trong câu hỏi" },
            { slug: "import", title: "Nhập / xuất câu hỏi (Excel, JSON)" },
            { slug: "sharing", title: "Chia sẻ & quyền xem" },
            { slug: "search", title: "Tìm bộ câu hỏi công khai" },
        ],
    },
    {
        slug: "learning",
        title: "Học & luyện tập",
        pages: [
            { slug: "learn-mode", title: "Chế độ Học" },
            { slug: "practice-test", title: "Bài luyện tập" },
            { slug: "comments", title: "Bình luận & đánh giá" },
        ],
    },
    {
        slug: "classes",
        title: "Lớp học",
        pages: [
            { slug: "create-join", title: "Tạo / tham gia lớp" },
            { slug: "members", title: "Thành viên & vai trò" },
            { slug: "assign-test", title: "Giao bài kiểm tra" },
            { slug: "take-test", title: "Làm bài kiểm tra" },
            { slug: "results", title: "Xem kết quả" },
        ],
    },
    {
        slug: "folders",
        title: "Thư mục",
        pages: [{ slug: "folders", title: "Thư mục" }],
    },
    {
        slug: "schedule",
        title: "Lịch kiểm tra",
        pages: [{ slug: "schedule", title: "Lịch kiểm tra" }],
    },
    {
        slug: "settings",
        title: "Cài đặt tài khoản",
        pages: [
            { slug: "account", title: "Tài khoản" },
            { slug: "subscription", title: "Gói đăng ký" },
            { slug: "billing", title: "Giao dịch" },
        ],
    },
    {
        slug: "policy",
        title: "Quy định nội dung",
        pages: [{ slug: "moderation", title: "Kiểm duyệt & vi phạm" }],
    },
    {
        slug: "faq",
        title: "Câu hỏi thường gặp",
        pages: [{ slug: "faq", title: "Câu hỏi thường gặp" }],
    },
];

/** Danh sách phẳng theo đúng thứ tự mục lục (dùng cho Trước / Tiếp theo) */
export const GUIDE_ENTRIES: GuideEntry[] = GUIDE.flatMap((group) =>
    group.pages.map((page) => ({ group, page, path: `${group.slug}/${page.slug}` })),
);

export const findGuideEntry = (group?: string, page?: string): GuideEntry | undefined =>
    GUIDE_ENTRIES.find((entry) => entry.group.slug === group && entry.page.slug === page);

/** Nhóm chỉ có một trang hiển thị như một mục lá trong cây */
export const isSinglePageGroup = (group: GuideGroup) => group.pages.length === 1;
