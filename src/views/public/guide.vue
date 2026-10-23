<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import { useAuthStore } from "@/stores/AuthStore";
import { copyToClipboard } from "@/services/ClipboardService";
import { GUIDE, GUIDE_ENTRIES, GUIDE_UPDATED, findGuideEntry, type GuideEntry } from "@/guide/manifest";
import { highlighterReady, loadHighlighter } from "@/services/RichContentService";
import { GUIDE_LOCALE, loadGuideMarkdown, renderGuide, type RenderedGuide } from "@/services/GuideService";
import GuideToc from "@/shared/components/Guide/GuideToc.vue";
import GuideSearch from "@/shared/components/Guide/GuideSearch.vue";
import "@/assets/rich-content.css";

/**
 * Trang Hướng dẫn sử dụng: /guide/:group/:page (public).
 * Cây mục lục bên trái (drawer khi < 768px), nội dung Markdown ở giữa, "Trên trang này" bên phải (>= 1200px).
 */
const route = useRoute();
const router = useRouter();
const { t } = useI18n();
// khung trang dùng cùng ngôn ngữ với nội dung hướng dẫn (không theo ngôn ngữ giao diện app)
const gt = (key: string, named: Record<string, unknown> = {}) => t(key, named, { locale: GUIDE_LOCALE });

const isLoggedIn = useAuthStore().checkUser();

const entry = ref<GuideEntry | null>(null);
const source = ref<string | null>(null);
const status = ref<"loading" | "ready" | "not-found" | "error">("loading");
const sourceCache = new Map<string, string>();
const tocOpen = ref(false);
const activeHeading = ref("");

const entryIndex = computed(() => (entry.value ? GUIDE_ENTRIES.findIndex((e) => e.path === entry.value!.path) : -1));
const previous = computed(() => (entryIndex.value > 0 ? GUIDE_ENTRIES[entryIndex.value - 1] : null));
const next = computed(() =>
    entryIndex.value >= 0 && entryIndex.value < GUIDE_ENTRIES.length - 1 ? GUIDE_ENTRIES[entryIndex.value + 1] : null,
);
const isSingle = computed(() => entry.value?.group.pages.length === 1);

const rendered = computed<RenderedGuide | null>(() => {
    // render lại khi highlight.js tải xong (code block có màu)
    void highlighterReady.value;
    if (source.value === null) return null;
    return renderGuide(source.value, { copyLabel: gt("rich_content.copy"), copiedLabel: gt("rich_content.copied") });
});

const toRoute = (target: GuideEntry) => ({ name: "guide", params: { group: target.group.slug, page: target.page.slug } });

//#region nạp trang theo route
const load = async () => {
    const group = route.params.group as string | undefined;
    const page = route.params.page as string | undefined;

    // /guide -> trang đầu; /guide/<nhóm> -> trang đầu của nhóm
    if (!group) {
        router.replace(toRoute(GUIDE_ENTRIES[0]));
        return;
    }
    if (!page) {
        const firstOfGroup = GUIDE.find((g) => g.slug === group)?.pages[0];
        if (firstOfGroup) {
            router.replace({ name: "guide", params: { group, page: firstOfGroup.slug } });
            return;
        }
    }

    const found = findGuideEntry(group, page);
    entry.value = found ?? null;
    if (!found) {
        status.value = "not-found";
        source.value = null;
        document.title = `AIQuizizz | ${gt("guide.title")}`;
        return;
    }

    document.title = `AIQuizizz | ${found.page.title} - ${gt("guide.title")}`;
    status.value = sourceCache.has(found.path) ? "ready" : "loading";
    source.value = sourceCache.get(found.path) ?? null;
    try {
        if (!sourceCache.has(found.path)) {
            const source = await loadGuideMarkdown(found.path);
            if (source === null) {
                status.value = "not-found";
                return;
            }
            sourceCache.set(found.path, source);
        }
        if (entry.value?.path !== found.path) return; // đã chuyển trang khác trong lúc tải
        source.value = sourceCache.get(found.path)!;
        status.value = "ready";
        if (rendered.value?.html.includes('class="rc-code"')) void loadHighlighter();
        await nextTick();
        scrollToHashOrTop();
    } catch (error) {
        console.error("Cannot load guide page", error);
        status.value = "error";
    }
};

watch(() => [route.params.group, route.params.page], load, { immediate: true });
watch(
    () => route.hash,
    () => {
        if (status.value === "ready") scrollToHashOrTop(true);
    },
);
//#endregion

//#region cuộn + mục đang đọc
const HEADER_OFFSET = 88;

function scrollToHashOrTop(smooth = false) {
    const id = decodeURIComponent(route.hash.replace(/^#/, ""));
    const target = id ? document.getElementById(id) : null;
    if (target) {
        target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
        activeHeading.value = id;
    } else {
        window.scrollTo({ top: 0 });
        activeHeading.value = rendered.value?.headings[0]?.id ?? "";
    }
}

let ticking = false;
const updateActiveHeading = () => {
    ticking = false;
    const headings = rendered.value?.headings ?? [];
    let current = headings[0]?.id ?? "";
    for (const heading of headings) {
        const el = document.getElementById(heading.id);
        if (el && el.getBoundingClientRect().top <= HEADER_OFFSET + 8) current = heading.id;
    }
    activeHeading.value = current;
};
const onScroll = () => {
    if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateActiveHeading);
    }
};

onMounted(() => window.addEventListener("scroll", onScroll, { passive: true }));
onBeforeUnmount(() => window.removeEventListener("scroll", onScroll));

const goToHeading = (id: string) => {
    router.replace({ hash: `#${id}` });
};
//#endregion

//#region click trong bài viết: nút Sao chép + link nội bộ
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

const onArticleClick = async (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;

    const copyButton = target?.closest?.("[data-rc-copy]") as HTMLElement | null;
    if (copyButton) {
        event.preventDefault();
        const code = copyButton.closest(".rc-code")?.querySelector("pre code")?.textContent ?? "";
        if (!(await copyToClipboard(code))) {
            message.error(gt("rich_content.copy_failed"));
            return;
        }
        const label = copyButton.querySelector(".rc-copy-label");
        if (!label) return;
        const original = label.textContent;
        label.textContent = copyButton.dataset.copiedLabel ?? "Copied";
        copyButton.classList.add("copied");
        if (copyResetTimer) clearTimeout(copyResetTimer);
        copyResetTimer = setTimeout(() => {
            label.textContent = original;
            copyButton.classList.remove("copied");
        }, 1500);
        return;
    }

    const link = target?.closest?.("a[data-guide-link]") as HTMLAnchorElement | null;
    // Ctrl/Cmd/Shift + click hoặc chuột giữa: để trình duyệt mở tab mới
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
    const href = link.getAttribute("href") ?? "";
    event.preventDefault();
    if (href.startsWith("#")) goToHeading(decodeURIComponent(href.slice(1)));
    else router.push(href);
};

onBeforeUnmount(() => {
    if (copyResetTimer) clearTimeout(copyResetTimer);
});
//#endregion

//#region phản hồi "Trang này có hữu ích không?" (chỉ lưu ở trình duyệt)
const FEEDBACK_KEY = "guide_feedback";
const readFeedback = (): Record<string, "yes" | "no"> => {
    try {
        return JSON.parse(localStorage.getItem(FEEDBACK_KEY) ?? "{}") ?? {};
    } catch {
        return {};
    }
};
const feedback = ref(readFeedback());
const giveFeedback = (value: "yes" | "no") => {
    if (!entry.value) return;
    feedback.value = { ...feedback.value, [entry.value.path]: value };
    try {
        localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback.value));
    } catch {
        // trình duyệt chặn lưu trữ: vẫn hiện lời cảm ơn
    }
};
//#endregion
</script>

<template>
    <div class="guide-page">
        <header class="guide-header">
            <button
                type="button"
                class="guide-icon-btn guide-menu-btn"
                :aria-label="gt('guide.open_toc')"
                :aria-expanded="tocOpen"
                @click="tocOpen = true"
            >
                <i class="bx bx-menu" aria-hidden="true"></i>
            </button>
            <RouterLink :to="{ name: isLoggedIn ? 'User_Dashboard' : 'home' }" class="guide-logo">AIQuizizz</RouterLink>
            <span class="guide-header-divider" aria-hidden="true"></span>
            <RouterLink :to="toRoute(GUIDE_ENTRIES[0])" class="guide-header-title">
                <i class="bx bx-book-open" aria-hidden="true"></i>
                <span>{{ gt("guide.title") }}</span>
            </RouterLink>
            <div class="guide-header-search">
                <GuideSearch shortcut />
            </div>
            <RouterLink :to="{ name: isLoggedIn ? 'User_Dashboard' : 'login' }" class="guide-app-btn">
                <span>{{ isLoggedIn ? gt("guide.open_app") : gt("guide.sign_in") }}</span>
                <i class="bx bx-right-arrow-alt" aria-hidden="true"></i>
            </RouterLink>
        </header>

        <button type="button" class="guide-toc-bar" :aria-expanded="tocOpen" @click="tocOpen = true">
            <i class="bx bx-list-ul" aria-hidden="true"></i>
            <span class="guide-toc-bar-label">{{ gt("guide.toc") }}</span>
            <span v-if="entry" class="guide-toc-bar-group">· {{ entry.group.title }}</span>
            <i class="bx bx-chevron-down guide-toc-bar-caret" aria-hidden="true"></i>
        </button>

        <div class="guide-body">
            <aside class="guide-sidebar" :aria-label="gt('guide.toc')">
                <p class="guide-eyebrow">{{ gt("guide.toc") }}</p>
                <nav>
                    <GuideToc :active-group="entry?.group.slug" :active-page="entry?.page.slug" />
                </nav>
                <p class="guide-updated">{{ gt("guide.updated", { date: GUIDE_UPDATED }) }}</p>
            </aside>

            <main class="guide-main">
                <article class="guide-article-wrap">
                    <template v-if="status === 'not-found'">
                        <div class="guide-state">
                            <i class="bx bx-search-alt" aria-hidden="true"></i>
                            <h1>{{ gt("guide.not_found_title") }}</h1>
                            <p>{{ gt("guide.not_found_content") }}</p>
                            <RouterLink :to="toRoute(GUIDE_ENTRIES[0])" class="guide-app-btn">
                                {{ gt("guide.back_to_start") }}
                            </RouterLink>
                        </div>
                    </template>
                    <template v-else-if="status === 'error'">
                        <div class="guide-state">
                            <i class="bx bx-error" aria-hidden="true"></i>
                            <p>{{ gt("guide.load_failed") }}</p>
                            <button type="button" class="guide-app-btn" @click="load">{{ gt("guide.retry") }}</button>
                        </div>
                    </template>
                    <template v-else-if="entry">
                        <nav class="guide-breadcrumb" :aria-label="gt('guide.breadcrumb')">
                            <RouterLink :to="toRoute(GUIDE_ENTRIES[0])">{{ gt("guide.short") }}</RouterLink>
                            <template v-if="!isSingle">
                                <i class="bx bx-chevron-right" aria-hidden="true"></i>
                                <RouterLink :to="toRoute({ ...entry, page: entry.group.pages[0] })">
                                    {{ entry.group.title }}
                                </RouterLink>
                            </template>
                            <i class="bx bx-chevron-right" aria-hidden="true"></i>
                            <span aria-current="page">{{ entry.page.title }}</span>
                        </nav>
                        <h1 class="guide-title">{{ entry.page.title }}</h1>
                        <a-skeleton v-if="status === 'loading'" :paragraph="{ rows: 8 }" />
                        <template v-else-if="rendered">
                            <p class="guide-meta">{{ gt("guide.reading_time", { n: rendered.readingMinutes }) }}</p>
                            <div
                                class="rich-content rc-block guide-article"
                                @click="onArticleClick"
                                v-html="rendered.html"
                            ></div>

                            <div class="guide-feedback">
                                <template v-if="feedback[entry.path]">
                                    <i class="bx bx-check-circle" aria-hidden="true"></i>
                                    <span>{{ gt("guide.thanks") }}</span>
                                </template>
                                <template v-else>
                                    <span>{{ gt("guide.helpful") }}</span>
                                    <button type="button" class="guide-chip" @click="giveFeedback('yes')">
                                        {{ gt("guide.yes") }}
                                    </button>
                                    <button type="button" class="guide-chip" @click="giveFeedback('no')">
                                        {{ gt("guide.no") }}
                                    </button>
                                </template>
                            </div>

                            <nav class="guide-pager">
                                <RouterLink v-if="previous" :to="toRoute(previous)" class="guide-pager-card">
                                    <span class="guide-pager-label">{{ gt("guide.previous") }}</span>
                                    <span class="guide-pager-title">
                                        <i class="bx bx-chevron-left" aria-hidden="true"></i>{{ previous.page.title }}
                                    </span>
                                </RouterLink>
                                <span v-else class="guide-pager-spacer"></span>
                                <RouterLink v-if="next" :to="toRoute(next)" class="guide-pager-card next">
                                    <span class="guide-pager-label">{{ gt("guide.next") }}</span>
                                    <span class="guide-pager-title">
                                        {{ next.page.title }}<i class="bx bx-chevron-right" aria-hidden="true"></i>
                                    </span>
                                </RouterLink>
                            </nav>
                        </template>
                    </template>
                </article>

                <aside v-if="status === 'ready' && rendered?.headings.length" class="guide-rail">
                    <p class="guide-eyebrow">{{ gt("guide.on_this_page") }}</p>
                    <ul>
                        <li v-for="heading in rendered.headings" :key="heading.id" :class="`level-${heading.level}`">
                            <a
                                :href="`#${heading.id}`"
                                :class="{ active: activeHeading === heading.id }"
                                @click.prevent="goToHeading(heading.id)"
                            >
                                {{ heading.text }}
                            </a>
                        </li>
                    </ul>
                </aside>
            </main>
        </div>

        <a-drawer
            v-model:open="tocOpen"
            placement="left"
            :width="320"
            :title="gt('guide.title')"
            class="guide-drawer"
            :body-style="{ padding: '12px' }"
        >
            <div class="guide-drawer-search">
                <GuideSearch @navigate="tocOpen = false" />
            </div>
            <nav :aria-label="gt('guide.toc')">
                <GuideToc
                    :active-group="entry?.group.slug"
                    :active-page="entry?.page.slug"
                    @navigate="tocOpen = false"
                />
            </nav>
        </a-drawer>
    </div>
</template>

<style scoped>
.guide-page {
    --guide-header-h: 64px;
    position: relative;
    z-index: 1;
    min-height: 100vh;
    background-color: var(--c-page);
    color: var(--c-text);
}

/* ---------- header ---------- */
.guide-header {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 16px;
    height: var(--guide-header-h);
    padding: 0 24px;
    border-bottom: 1px solid var(--c-border);
    background-color: var(--c-surface);
}
.guide-logo {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.3px;
    text-decoration: none;
    background: var(--brand-gradient-text);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
}
.guide-header-divider {
    width: 1px;
    height: 24px;
    background-color: var(--c-border);
}
.guide-header-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-right: auto;
    color: var(--c-text);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
}
.guide-header-title i {
    font-size: 20px;
    color: var(--c-primary-text);
}
.guide-header-search {
    width: 360px;
}
.guide-app-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 40px;
    padding: 0 16px;
    border: 0;
    border-radius: var(--ui-r-md);
    background-color: var(--c-primary);
    color: var(--c-on-primary);
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    cursor: pointer;
}
.guide-app-btn:hover {
    background-color: var(--c-primary-hover);
    color: var(--c-on-primary);
}
.guide-app-btn i {
    font-size: 18px;
}
.guide-icon-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-md);
    background: transparent;
    color: var(--c-text);
    cursor: pointer;
}
.guide-icon-btn i {
    font-size: 22px;
}
.guide-app-btn:focus-visible,
.guide-icon-btn:focus-visible,
.guide-toc-bar:focus-visible,
.guide-chip:focus-visible,
.guide-pager-card:focus-visible,
.guide-rail a:focus-visible {
    outline: 2px solid var(--c-focus-ring);
    outline-offset: 2px;
}

/* ---------- thanh "Mục lục" (mobile) ---------- */
.guide-toc-bar {
    display: none;
    position: sticky;
    top: var(--guide-header-h);
    z-index: 15;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    border-bottom: 1px solid var(--c-border);
    background-color: var(--c-surface);
    color: var(--c-text-muted);
    font-size: 14px;
    text-align: left;
    cursor: pointer;
}
.guide-toc-bar i:first-child,
.guide-toc-bar-label {
    color: var(--c-primary-text);
    font-weight: 500;
}
.guide-toc-bar i:first-child {
    font-size: 18px;
}
.guide-toc-bar-group {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.guide-toc-bar-caret {
    margin-left: auto;
    font-size: 18px;
}

/* ---------- bố cục ---------- */
.guide-body {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 16px;
}
.guide-sidebar {
    position: sticky;
    top: calc(var(--guide-header-h) + 16px);
    display: flex;
    flex-direction: column;
    flex: 0 0 280px;
    height: calc(100vh - var(--guide-header-h) - 32px);
    padding: 16px;
    overflow-y: auto;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-xl);
    background-color: var(--c-surface);
}
.guide-sidebar nav {
    flex: 1;
}
.guide-eyebrow {
    margin: 0 0 8px;
    color: var(--c-text-muted);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}
.guide-updated {
    margin: 16px 0 0;
    color: var(--c-text-muted);
    font-size: 12px;
}
.guide-main {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    flex: 1;
    min-width: 0;
}
.guide-article-wrap {
    flex: 0 1 840px;
    min-width: 0;
    padding: 32px 40px 36px;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-xl);
    background-color: var(--c-surface);
}
.guide-rail {
    position: sticky;
    top: calc(var(--guide-header-h) + 16px);
    flex: 0 0 200px;
    max-height: calc(100vh - var(--guide-header-h) - 32px);
    padding: 4px 0;
    overflow-y: auto;
}
.guide-rail ul {
    list-style: none;
    margin: 0;
    padding: 0;
    border-left: 1px solid var(--c-border);
}
.guide-rail a {
    display: block;
    margin-left: -1px;
    padding: 6px 0 6px 12px;
    border-left: 2px solid transparent;
    color: var(--c-text-muted);
    font-size: 13px;
    line-height: 1.45;
    text-decoration: none;
}
.guide-rail li.level-3 a {
    padding-left: 24px;
}
.guide-rail a:hover {
    color: var(--c-text);
}
.guide-rail a.active {
    border-left-color: var(--c-primary);
    color: var(--c-primary-text);
    font-weight: 500;
}

/* ---------- bài viết ---------- */
.guide-breadcrumb {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
    margin-bottom: 12px;
    color: var(--c-text-muted);
    font-size: 13px;
}
.guide-breadcrumb a {
    color: var(--c-text-muted);
    text-decoration: none;
}
.guide-breadcrumb a:hover {
    color: var(--c-primary-text);
    text-decoration: underline;
}
.guide-breadcrumb span {
    color: var(--c-text);
}
.guide-title {
    margin: 0 0 6px;
    color: var(--c-text);
    font-size: 32px;
    font-weight: 700;
    line-height: 1.25;
}
.guide-meta {
    margin: 0 0 20px;
    padding-bottom: 20px;
    border-bottom: 1px solid var(--c-border);
    color: var(--c-text-muted);
    font-size: 13px;
}
.guide-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 64px 16px;
    text-align: center;
    color: var(--c-text-muted);
}
.guide-state i {
    font-size: 48px;
}
.guide-state h1 {
    margin: 0;
    color: var(--c-text);
    font-size: 24px;
}
.guide-feedback {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin-top: 40px;
    padding-top: 20px;
    border-top: 1px solid var(--c-border);
    color: var(--c-text);
    font-size: 14px;
}
.guide-feedback i {
    font-size: 20px;
    color: var(--c-success);
}
.guide-chip {
    min-height: 32px;
    padding: 0 14px;
    border: 1px solid var(--c-border-strong);
    border-radius: 999px;
    background: transparent;
    color: var(--c-text);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
}
.guide-chip:hover {
    border-color: var(--c-primary);
    color: var(--c-primary-text);
}
.guide-pager {
    display: flex;
    gap: 16px;
    margin-top: 24px;
}
.guide-pager-card,
.guide-pager-spacer {
    flex: 1 1 0;
    min-width: 0;
}
.guide-pager-card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-lg);
    text-decoration: none;
}
.guide-pager-card.next {
    align-items: flex-end;
    text-align: right;
}
.guide-pager-card:hover {
    border-color: var(--c-primary);
}
.guide-pager-label {
    color: var(--c-text-muted);
    font-size: 12px;
}
.guide-pager-title {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--c-primary-text);
    font-size: 15px;
    font-weight: 600;
}
.guide-pager-title i {
    font-size: 18px;
}
.guide-drawer-search {
    margin-bottom: 12px;
}

/* ---------- responsive ---------- */
@media (max-width: 1199.98px) {
    .guide-rail {
        display: none;
    }
}
@media (max-width: 991.98px) {
    .guide-header-search {
        width: 240px;
    }
    .guide-sidebar {
        flex-basis: 248px;
    }
}
@media (max-width: 767.98px) {
    .guide-page {
        --guide-header-h: 56px;
    }
    .guide-header {
        gap: 10px;
        padding: 0 12px;
    }
    .guide-icon-btn,
    .guide-toc-bar {
        display: flex;
    }
    .guide-header-divider,
    .guide-header-search,
    .guide-sidebar {
        display: none;
    }
    .guide-header-title span {
        display: none;
    }
    .guide-header-title {
        margin-right: auto;
    }
    .guide-app-btn {
        padding: 0 12px;
    }
    .guide-body {
        padding: 12px;
    }
    .guide-article-wrap {
        padding: 20px 16px 24px;
    }
    .guide-title {
        font-size: 26px;
    }
    .guide-pager {
        flex-direction: column;
        gap: 12px;
    }
    .guide-pager-spacer {
        display: none;
    }
}
</style>

<style>
/* ---- nội dung Markdown của trang Hướng dẫn (v-html nên không dùng scoped) ---- */
.guide-article.rich-content {
    color: var(--c-text);
    font-size: 16px;
    line-height: 1.7;
}
.guide-article.rich-content p,
.guide-article.rich-content ul,
.guide-article.rich-content ol {
    margin: 0 0 1em;
}
/* main.css có rule "ol { margin: 0 !important }" rò ra toàn app: ghi đè trong phạm vi bài hướng dẫn */
.guide-article.rich-content ol {
    margin: 0 0 1em !important;
}
.guide-article.rich-content li + li {
    margin-top: 0.35em;
}
.guide-article.rich-content h2,
.guide-article.rich-content h3 {
    scroll-margin-top: 88px;
    color: var(--c-text);
    font-weight: 600;
}
.guide-article.rich-content h2 {
    margin: 1.8em 0 0.6em;
    font-size: 22px;
    line-height: 1.35;
}
.guide-article.rich-content h3 {
    margin: 1.4em 0 0.5em;
    font-size: 18px;
    line-height: 1.4;
}
.guide-article.rich-content strong {
    color: var(--c-text);
    font-weight: 600;
}
.guide-article.rich-content .rc-table-wrap,
.guide-article.rich-content .rc-code {
    margin: 1em 0 1.2em;
}
.guide-article.rich-content th,
.guide-article.rich-content td {
    padding: 8px 14px;
    border-color: var(--c-border);
}
.guide-article.rich-content table {
    width: 100%;
}
.guide-article.rich-content .guide-img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 1em 0;
    border: 1px solid var(--c-border);
    border-radius: var(--ui-r-lg);
}
/* khối code, bảng, ghi chú: bo 12 (rich-content.css dùng chung bo 8) */
.guide-article.rich-content .rc-code,
.guide-article.rich-content .rc-table-wrap {
    border-radius: var(--ui-r-lg);
}
.guide-article.rich-content .rc-table-wrap {
    border: 1px solid var(--c-border);
}
.guide-article.rich-content table {
    border-collapse: separate;
    border-spacing: 0;
}
.guide-article.rich-content th,
.guide-article.rich-content td {
    border-width: 0 1px 1px 0;
    overflow-wrap: normal;
    word-break: normal;
}
.guide-article.rich-content tr > :last-child {
    border-right-width: 0;
}
.guide-article.rich-content tr:last-child > * {
    border-bottom-width: 0;
}
.guide-article.rich-content .rc-copy {
    border-radius: var(--ui-r-sm);
}
.guide-article.rich-content :not(pre) > code {
    border-radius: var(--ui-r-xs);
}
.guide-article.rich-content blockquote.guide-callout {
    margin: 1.2em 0;
    padding: 12px 16px;
    border-left: 3px solid var(--guide-callout-accent);
    border-radius: var(--ui-r-lg);
    background-color: color-mix(in srgb, var(--guide-callout-accent) 9%, var(--c-surface));
    color: var(--c-text);
}
.guide-article.rich-content blockquote.guide-callout > :last-child {
    margin-bottom: 0;
}
.guide-article.rich-content .guide-callout-title {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0 0 4px !important;
    color: var(--guide-callout-text);
    font-size: 14px;
    font-weight: 600;
}
.guide-article.rich-content .guide-callout-title i {
    font-size: 18px;
}
.guide-callout-tip {
    --guide-callout-accent: var(--c-primary);
    --guide-callout-text: var(--c-primary-text);
}
.guide-callout-note {
    --guide-callout-accent: var(--category-1st-color);
    --guide-callout-text: var(--c-text);
}
.guide-callout-warning {
    --guide-callout-accent: var(--c-warning);
    --guide-callout-text: var(--c-warning-text);
}
@media (max-width: 767.98px) {
    .guide-article.rich-content {
        font-size: 15px;
    }
    .guide-article.rich-content h2 {
        font-size: 20px;
        scroll-margin-top: 112px;
    }
    .guide-article.rich-content h3 {
        scroll-margin-top: 112px;
    }
}
</style>
