<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

interface optionModel {
    label: string;
    value: string;
}

const { t } = useI18n();

const modelValue = defineModel<optionModel>("modelValue");
const label = defineModel<string>("label");

const optionKeys = defineModel<string[]>("options");
const options = computed(() =>
    (optionKeys.value ?? []).map((key) => ({
        label: key,
        value: key,
    })),
);

modelValue.value = options.value[0];
</script>

<template>
    <a-form-item :label="label" name="title" class="input-item">
        <a-select v-model:value="modelValue" class="input">
            <a-select-option v-for="option in options" :value="option.value">
                {{ option.label }}
            </a-select-option>
        </a-select>
    </a-form-item>
</template>
<style scoped>
.input-item {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0px;
    color: var(--c-text);
    width: 100%;
}

.input {
    border: none;
    color: var(--c-text);
}

/* */

::v-deep(.input input) {
    color: var(--c-text);
    background: var(--input-item-background-color);
}

::v-deep(.ant-form-item-label > label) {
    color: var(--c-text);
    font-weight: 600;
    font-size: 13px;
}

::v-deep(.input i) {
    color: var(--c-text-muted);
    transform: translateY(1px);
    margin-right: 8px;
}
</style>
