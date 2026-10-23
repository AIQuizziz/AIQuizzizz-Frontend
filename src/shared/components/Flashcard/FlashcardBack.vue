<script setup lang="ts">
import { computed } from "vue";
import type { Flashcard } from "@/models/flashcard";
import FlashcardAudioButton from "./FlashcardAudioButton.vue";
import FlashcardSourceInfo from "./FlashcardSourceInfo.vue";

/**
 * Mặt sau thẻ LanguageFlashcard (chỉ-đọc): phiên âm + nút nghe, các nghĩa (từ loại, định nghĩa, bản dịch, ví dụ, từ đồng nghĩa)
 * và (tuỳ chọn) nguồn / trạng thái tra từ điển. Chuỗi từ thẻ luôn render bằng {{ }} (không v-html).
 */
const props = withDefaults(defineProps<{ card?: Flashcard | null; showSource?: boolean }>(), {
    card: null,
    showSource: false,
});

const phonetic = computed(() => (props.card?.back?.phonetic ?? "").trim());
const audioUrl = computed(() => props.card?.back?.audioUrl ?? "");
const meanings = computed(() => props.card?.back?.meanings ?? []);
const text = (value: string | null | undefined) => (value ?? "").trim();
const filled = (values: (string | null | undefined)[] | null | undefined) =>
    (values ?? []).map(text).filter((x) => x.length > 0);
</script>
<template>
    <div v-if="card" class="flashcard-back">
        <div v-if="phonetic || audioUrl" class="flashcard-back-head">
            <span v-if="phonetic" class="flashcard-phonetic">{{ phonetic }}</span>
            <FlashcardAudioButton :url="audioUrl" />
        </div>
        <div v-for="(meaning, index) in meanings" :key="index" class="flashcard-meaning">
            <div class="flashcard-meaning-head">
                <span class="flashcard-meaning-index">{{ index + 1 }}</span>
                <span v-if="text(meaning.pos)" class="flashcard-pos">{{ text(meaning.pos) }}</span>
            </div>
            <div v-if="text(meaning.translation)" class="flashcard-translation">
                {{ text(meaning.translation) }}
            </div>
            <div v-if="text(meaning.definition)" class="flashcard-definition">
                {{ text(meaning.definition) }}
            </div>
            <ul v-if="filled(meaning.examples).length > 0" class="flashcard-examples">
                <li v-for="(example, i) in filled(meaning.examples)" :key="i">{{ example }}</li>
            </ul>
            <div v-if="filled(meaning.synonyms).length > 0" class="flashcard-synonyms">
                <span class="flashcard-synonyms-label">{{ $t("flashcard.synonyms") }}:</span>
                <span
                    v-for="(synonym, i) in filled(meaning.synonyms)"
                    :key="i"
                    class="flashcard-synonym"
                >
                    {{ synonym }}
                </span>
            </div>
        </div>
        <div v-if="meanings.length === 0 && !phonetic" class="flashcard-empty">
            {{ $t("flashcard.no_meanings") }}
        </div>
        <FlashcardSourceInfo v-if="showSource" :card="card" />
    </div>
</template>
<style scoped>
.flashcard-back {
    min-width: 0;
    color: var(--text-color);
}

.flashcard-back-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
}

.flashcard-phonetic {
    font-size: 16px;
    color: var(--text-color-grey);
    overflow-wrap: anywhere;
}

.flashcard-meaning {
    padding: 8px 0;
}

.flashcard-meaning + .flashcard-meaning {
    border-top: 1px solid var(--content-item-border-color);
}

.flashcard-meaning-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.flashcard-meaning-index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    border-radius: var(--ui-r-xs);
    background-color: color-mix(in srgb, var(--main-color) 14%, var(--c-surface));
    color: var(--c-primary-text);
    font-size: 12px;
    font-weight: 600;
}

.flashcard-pos {
    padding: 0 8px;
    border: 1px solid var(--content-item-border-color);
    border-radius: 999px;
    font-size: 12px;
    font-style: italic;
    color: var(--text-color-grey);
}

.flashcard-translation {
    font-weight: 600;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

.flashcard-definition {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

.flashcard-examples {
    margin: 6px 0 0;
    padding-left: 20px;
    color: var(--text-color-grey);
    font-style: italic;
}

.flashcard-examples li {
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

.flashcard-synonyms {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 6px;
    font-size: 13px;
}

.flashcard-synonyms-label {
    color: var(--text-color-grey);
}

.flashcard-synonym {
    padding: 0 8px;
    border: 1px solid var(--content-item-border-color);
    border-radius: 999px;
}

.flashcard-empty {
    color: var(--text-color-grey);
    font-style: italic;
}
</style>
