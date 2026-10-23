<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { safeHttpsUrl } from "@/services/FlashcardService";

/** Nút nghe phát âm: chỉ hiện khi URL là https (không bao giờ gắn URL khác vào Audio) */
const props = defineProps<{ url?: string | null }>();

const { t } = useI18n();
const src = computed(() => safeHttpsUrl(props.url));

let audio: HTMLAudioElement | null = null;

const play = async () => {
    if (!src.value) return;
    try {
        audio?.pause();
        audio = new Audio(src.value);
        await audio.play();
    } catch (error) {
        console.log("ERROR: play flashcard audio", error);
        message.error(t("flashcard.audio_error"));
    }
};

onBeforeUnmount(() => audio?.pause());
</script>
<template>
    <button
        v-if="src"
        type="button"
        class="flashcard-audio-btn"
        :title="$t('flashcard.play_audio')"
        :aria-label="$t('flashcard.play_audio')"
        @click.stop="play"
    >
        <i class="bx bx-volume-full"></i>
    </button>
</template>
<style scoped>
.flashcard-audio-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 1px solid var(--content-item-border-color);
    border-radius: 50%;
    background: var(--c-surface-raised);
    color: var(--c-primary-text);
    cursor: pointer;
    transition: all 0.15s ease;
}

.flashcard-audio-btn:hover,
.flashcard-audio-btn:focus-visible {
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    border-color: var(--main-color);
}

.flashcard-audio-btn i {
    font-size: 18px;
}
</style>
