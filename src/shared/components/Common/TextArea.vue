<script setup lang="ts">
import { computed, getCurrentInstance } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// hỗ trợ cả v-model và v-model:value ở component cha
const rawModelValue = defineModel<string>("modelValue");
const rawValue = defineModel<string>("value");
const instance = getCurrentInstance();
const usesAlias = () => {
    const p = instance?.vnode.props ?? {};
    return "value" in p || "onUpdate:value" in p;
};
const modelValue = computed<string | undefined>({
    get: () => (usesAlias() ? rawValue.value : rawModelValue.value),
    set: (v) => {
        if (usesAlias()) rawValue.value = v;
        else rawModelValue.value = v;
    },
});
const placeholder = defineModel<string>("placeholder");
const label = defineModel<string>("label");
const name = defineModel<string>("name");

const maxLength = defineModel<number>("maxLength");
const isRequired = defineModel<boolean>("isRequired");
const readonly = defineModel<boolean>("readonly");

const emit = defineEmits(["change"]);

const onUpdate = () => {
    emit("change", modelValue.value);
};

const checkInvalid = () => {
    const valueLength = modelValue.value?.length ?? 0;
    const max = maxLength.value ?? Infinity;

    const required = isRequired.value;
    const isEmpty = !modelValue.value;

    const isOutOfRange = valueLength > max;
    const isInvalid = (required && isEmpty) || isOutOfRange;

    let message = t("message.required");
    if (isOutOfRange) message = t("message.out_of_range", { max_length: max });

    return { isInvalid, message };
};
</script>

<template>
    <a-form-item :label="label" :name="name" class="input-item">
        <a-tooltip
            :title="checkInvalid().isInvalid ? checkInvalid().message : null"
            color="var(--c-solid-danger)"
        >
            <a-textarea
                :readonly="readonly"
                @input="onUpdate"
                v-model:value="modelValue"
                :placeholder="placeholder"
                class="input"
                :class="['input', checkInvalid().isInvalid ? 'is-invalid' : '']"
            >
                <template #prefix>
                    <slot name="icon" />
                </template>
            </a-textarea>
        </a-tooltip>
    </a-form-item>
</template>
<style scoped>
.input-item {
    display: flex;
    justify-content: center;
    margin-bottom: 0px;
    color: var(--c-text);
    width: 100%;
}

.input {
    height: 35px;
    padding: 8px 12px;
    font-size: 14px;
    background-color: var(--form-item-background-color);
    border: 1px solid var(--form-item-border-color);
    border-radius: var(--ui-r-sm);
    min-height: 60px;
    max-height: 160px;
    color: var(--c-text);
}

.input.is-invalid {
    border: 1px solid var(--c-danger) !important;
}

.input::placeholder {
    color: var(--c-placeholder);
}

.input:focus-within {
    box-shadow: none;
}
/*---*/

::v-deep(.input textarea) {
    color: var(--c-text);
    background-color: var(--content-item-children-background-color);
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

::v-deep(.ant-row) {
    width: 100% !important;
}
</style>
