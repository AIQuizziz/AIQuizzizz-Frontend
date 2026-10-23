import "./assets/main.css";

import { createApp } from "vue";
import { createPinia } from "pinia";
import { createPersistedState } from "pinia-plugin-persistedstate";

import App from "./App.vue";
import router from "./router/router-index";

/**
 * highchart
 * **/
import HighchartsVue from "highcharts-vue";

/**
 * boostrap
 * **/
import "bootstrap/dist/css/bootstrap.css";
import "bootstrap-vue-3/dist/bootstrap-vue-3.css";

/**
 * Boxicons
 * **/
import "boxicons/css/boxicons.min.css";

/**
 * Theme tokens + responsive overrides: phải import SAU bootstrap / bootstrap-vue-3 để thắng độ ưu tiên
 * (xem docs/THEME-AND-RESPONSIVE.md)
 * **/
import "./assets/theme-overrides.css";
import "./assets/ui-refresh.css";
import "./assets/responsive.css";

/**
 * jquery
 * **/
// @ts-ignore
import $ from "jquery";
window.$ = $; //register jquery as global

import axios from "axios";
window.axios = axios; //register axios as global

import API from "@/api/Api";
window.api = API; //register api as global

/**
 * ant-design
 * **/
import {
    Alert,
    Pagination,
    Button,
    Modal,
    Form,
    Input,
    DatePicker,
    TimePicker,
    InputNumber,
    Select,
    Switch,
    Dropdown,
    Checkbox,
    Upload,
    Radio,
    Tooltip,
    Row,
    Col,
    Divider,
    Popconfirm,
    Menu,
    QRCode,
    Tag,
    Calendar,
    Empty,
    Badge,
    Steps,
    Progress,
    Result,
    Tabs,
    Drawer,
    Spin,
    Table,
    Rate,
    Skeleton,
    Tree,
    ConfigProvider
} from "ant-design-vue";

/**
 * pinia - persistent
 * **/
const pinia = createPinia();
pinia.use(createPersistedState());

/**
 * vue-i18n - multiple languges
 * **/
import i18n from "@/services/i18n";

async function loadLocale(locale: string): Promise<void> {
    let messages;
    try {
        messages = (await import(`./locales/${locale}.json`)).default;
    } catch (error) {
        console.error(`Failed to load locale '${locale}':`, error);
        messages = (await import(`./locales/en.json`)).default;
    }

    i18n.global.setLocaleMessage(locale, messages);
    (i18n.global.locale as any).value = locale;
}

async function initLocale(): Promise<void> {
    const savedLocale: string = localStorage.getItem("locale") || "en";
    await loadLocale(savedLocale);
}

const colors = ["purple", "blue", "green", "red", "amber", "pink"];

const storedThemeClass = localStorage.getItem("theme") || "theme-light";
const isDarkSystem = window.matchMedia("(prefers-color-scheme: dark)").matches;

const systemThemeClass = isDarkSystem ? "theme-dark" : "theme-light";
const themeClass = storedThemeClass === "theme-system" ? systemThemeClass : storedThemeClass;
document.documentElement.classList.add(themeClass);

const storedColorClass = localStorage.getItem("accent_color") || "purple";
if (colors.includes(storedColorClass)) {
    document.documentElement.classList.add(storedColorClass);
}
/**
 * vue-virtual-scroller
 **/
//please don't take my sun shine away
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

/**
 * Promise reject không ai bắt: lỗi API (axios) đã được interceptor hiển thị toast nên không cần
 * văng "Uncaught (in promise)" ra console/page error; lỗi validate của ant-design form cũng vậy.
 * Các lỗi khác vẫn được log để không che mất bug thật.
 * **/
window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason: any = event.reason;
    if (reason?.isAxiosError || Array.isArray(reason?.errorFields) || reason?.code === "ERR_CANCELED") {
        event.preventDefault();
        return;
    }
    console.error("Unhandled promise rejection:", reason);
});

(async () => {
    await initLocale();
    const app = createApp(App);

    app.use(Alert);
    app.use(Pagination);
    app.use(Button);
    app.use(Modal);
    app.use(Form);
    app.use(Input);
    app.use(InputNumber);
    app.use(DatePicker);
    app.use(TimePicker);
    app.use(Checkbox);
    app.use(Select);
    app.use(Switch);
    app.use(Dropdown);
    app.use(Upload);
    app.use(Radio);
    app.use(Tooltip);
    app.use(Row);
    app.use(Col);
    app.use(Divider);
    app.use(Popconfirm);
    app.use(Menu);
    app.use(QRCode);
    app.use(Tag);
    app.use(Calendar);
    app.use(Empty);
    app.use(Badge);
    app.use(Steps);
    app.use(Progress);
    app.use(Result);
    app.use(Tabs);
    app.use(Drawer);
    app.use(Spin);
    app.use(Table);
    app.use(Rate);
    app.use(Skeleton);
    app.use(Tree);
    app.use(ConfigProvider);

    app.use(HighchartsVue);

    app.use(pinia);
    app.use(router);
    app.use(i18n);

    app.mount("#app");
})();
