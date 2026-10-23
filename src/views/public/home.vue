<script setup lang="ts">
import home_banner from "@/assets/banner_image.png";
import home_vector from "@/assets/home_vector.png";

import { StarOutlined, AppstoreOutlined } from "@ant-design/icons-vue";
import Header from "@/shared/components/Header.vue";
</script>
<template>
    <Header />
    <div class="background">
        <div class="pattern pattern-top" :style="{ backgroundImage: `url(${home_vector})` }"></div>
        <div
            class="pattern pattern-bottom"
            :style="{ backgroundImage: `url(${home_vector})` }"
        ></div>
        <div class="w-100 h-100 d-flex justify-content-between align-items-center">
            <div class="eclipse eclipse-left"></div>
            <div class="eclipse eclipse-right"></div>
        </div>
        <div class="content-container">
            <div class="d-flex flex-column justify-content-center align-items-center">
                <div class="home-content-item">
                    <!-- <div class="home-content-item-icon">⭐</div> -->
                    ✨
                    <div>{{ $t("homepage.ultimateExperience.sub_title") }}</div>
                </div>
                <div class="home-content-item">
                    {{ $t("homepage.ultimateExperience.moto.learnQuiz") }}
                    <span>
                        {{ $t("homepage.ultimateExperience.moto.earnRewards") }}
                    </span>
                </div>
                <div class="home-content-item">
                    {{ $t("homepage.ultimateExperience.content") }}
                </div>
                <div class="home-content-item">
                    <RouterLink :to="{ name: 'User_Dashboard' }">
                        {{ $t("homepage.ultimateExperience.buttons.started") }}
                    </RouterLink>
                    <RouterLink :to="{ name: 'User_QuestionSet_Search' }">
                        {{ $t("homepage.ultimateExperience.buttons.explore") }}
                    </RouterLink>
                </div>
            </div>
        </div>
    </div>
    <div class="background background-responsive">
        <div class="content-container">
            <div class="d-flex flex-column justify-content-center align-items-center">
                <div class="home-content-item">
                    <!-- <div class="home-content-item-icon">⭐</div> -->
                    🎲
                    <div>{{ $t("homepage.categories.sub_title") }}</div>
                </div>
                <div class="home-content-item">
                    {{ $t("homepage.categories.moto.explore") }}
                    <span>
                        {{ $t("homepage.categories.moto.quizCategories") }}
                    </span>
                </div>
                <div class="home-content-item">
                    {{ $t("homepage.categories.content") }}
                </div>
                <div class="home-content-item">
                    <div class="category-item-container">
                        <div class="category-item">
                            <i class="bx bx-atom category-item-icon"></i>
                            <div class="category-item-content">
                                <span>
                                    {{ $t("homepage.categories.scienceTech.name") }}
                                </span>
                                <br />
                                <span>
                                    {{ $t("homepage.categories.scienceTech.description") }}
                                </span>
                                <br />
                                <RouterLink :to="{ name: 'User_QuestionSet_Search' }">
                                    {{ $t("homepage.categories.categories_link") }}
                                    <i class="bx bx-right-arrow-alt"></i>
                                </RouterLink>
                            </div>
                        </div>
                        <div class="category-item">
                            <i class="bx bx-math category-item-icon"></i>
                            <div class="category-item-content">
                                <span>
                                    {{ $t("homepage.categories.mathematics.name") }}
                                </span>
                                <br />
                                <span>
                                    {{ $t("homepage.categories.mathematics.description") }}
                                </span>
                                <br />
                                <RouterLink :to="{ name: 'User_QuestionSet_Search' }">
                                    {{ $t("homepage.categories.categories_link")
                                    }}<i class="bx bx-right-arrow-alt"></i>
                                </RouterLink>
                            </div>
                        </div>
                        <div class="category-item">
                            <i class="bx bxs-flask category-item-icon"></i>
                            <div class="category-item-content">
                                <span>
                                    {{ $t("homepage.categories.chemistry.name") }}
                                </span>
                                <br />
                                <span>
                                    {{ $t("homepage.categories.chemistry.description") }}
                                </span>
                                <br />
                                <RouterLink :to="{ name: 'User_QuestionSet_Search' }">
                                    {{ $t("homepage.categories.categories_link")
                                    }}<i class="bx bx-right-arrow-alt"></i>
                                </RouterLink>
                            </div>
                        </div>
                        <div class="category-item">
                            <i class="bx bx-dna category-item-icon"></i>
                            <div class="category-item-content">
                                <span>
                                    {{ $t("homepage.categories.biology.name") }}
                                </span>
                                <br />
                                <span>
                                    {{ $t("homepage.categories.biology.description") }}
                                </span>
                                <br />
                                <RouterLink :to="{ name: 'User_QuestionSet_Search' }">
                                    {{ $t("homepage.categories.categories_link") }}
                                    <i class="bx bx-right-arrow-alt"></i>
                                </RouterLink>
                            </div>
                        </div>
                        <div class="category-item">
                            <i class="bx bx-globe category-item-icon"></i>
                            <div class="category-item-content">
                                <span>
                                    {{ $t("homepage.categories.generalKnowledge.name") }}
                                </span>
                                <br />
                                <span>
                                    {{ $t("homepage.categories.generalKnowledge.description") }}
                                </span>
                                <br />
                                <RouterLink :to="{ name: 'User_QuestionSet_Search' }">
                                    {{ $t("homepage.categories.categories_link") }}
                                    <i class="bx bx-right-arrow-alt"></i>
                                </RouterLink>
                            </div>
                        </div>
                        <div class="category-item">
                            <i class="bx bx-news category-item-icon"></i>
                            <div class="category-item-content">
                                <span>
                                    {{ $t("homepage.categories.currentAffairs.name") }}
                                </span>
                                <br />
                                <span>
                                    {{ $t("homepage.categories.currentAffairs.description") }}
                                </span>
                                <br />
                                <RouterLink :to="{ name: 'User_QuestionSet_Search' }">
                                    {{ $t("homepage.categories.categories_link") }}
                                    <i class="bx bx-right-arrow-alt"></i>
                                </RouterLink>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="background background-responsive">
        <div class="content-container">
            <div class="d-flex flex-column justify-content-center align-items-center">
                <div class="home-content-item">
                    🤖
                    <div>{{ $t("homepage.features.sub_title") }}</div>
                </div>
                <div class="home-content-item">
                    {{ $t("homepage.features.moto.why") }}
                    <span>{{ $t("homepage.features.moto.aiQuiz") }}</span>
                </div>
                <div class="home-content-item">
                    {{ $t("homepage.features.content") }}
                </div>
                <div class="home-content-item">
                    <div class="feature-item-container">
                        <div class="feature-item">
                            <i class="bx bx-brain feature-item-icon"></i>
                            <div class="category-item-content">
                                <span>{{ $t("homepage.features.personalizedLearning.name") }}</span>
                                <br />
                                <span>{{
                                    $t("homepage.features.personalizedLearning.description")
                                }}</span>
                            </div>
                        </div>
                        <div class="feature-item">
                            <i class="bx bx-gift feature-item-icon"></i>
                            <div class="category-item-content">
                                <span>{{ $t("homepage.features.rewardSystem.name") }}</span>
                                <br />
                                <span>{{ $t("homepage.features.rewardSystem.description") }}</span>
                            </div>
                        </div>
                        <div class="feature-item">
                            <i class="bx bxs-group feature-item-icon"></i>
                            <div class="category-item-content">
                                <span>{{ $t("homepage.features.teacherDashboard.name") }}</span>
                                <br />
                                <span>{{
                                    $t("homepage.features.teacherDashboard.description")
                                }}</span>
                            </div>
                        </div>
                        <div class="feature-item">
                            <i class="bx bx-signal-5 feature-item-icon"></i>
                            <div class="category-item-content">
                                <span>{{ $t("homepage.features.progressTracking.name") }}</span>
                                <br />
                                <span>{{
                                    $t("homepage.features.progressTracking.description")
                                }}</span>
                            </div>
                        </div>
                        <div class="feature-item">
                            <i class="bx bx-trophy feature-item-icon"></i>
                            <div class="category-item-content">
                                <span>{{
                                    $t("homepage.features.competitiveLeaderboards.name")
                                }}</span>
                                <br />
                                <span>{{
                                    $t("homepage.features.competitiveLeaderboards.description")
                                }}</span>
                            </div>
                        </div>
                        <div class="feature-item">
                            <i class="bx bx-mobile-alt feature-item-icon"></i>
                            <div class="category-item-content">
                                <span>{{ $t("homepage.features.mobileFriendly.name") }}</span>
                                <br />
                                <span>{{
                                    $t("homepage.features.mobileFriendly.description")
                                }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="background">
        <div class="w-100 d-flex justify-content-center">
            <div class="banner">
                <div class="banner-item">
                    <div>{{ $t("homepage.banner.title") }}</div>
                    <div>
                        {{ $t("homepage.banner.content") }}
                    </div>
                    <div>
                        <RouterLink :to="{ name: 'register' }">{{
                            $t("homepage.banner.buttons.createAccount")
                        }}</RouterLink>
                        <RouterLink :to="{ name: 'User_QuestionSet_Search' }">{{
                            $t("homepage.banner.buttons.explore")
                        }}</RouterLink>
                    </div>
                </div>
                <div class="banner-item">
                    <div
                        class="banner-item-img"
                        :style="{ backgroundImage: `url(${home_banner})` }"
                    ></div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.background {
    height: 100vh;
    background-color: var(--content-item-background-color);
    overflow-x: hidden;
    position: relative;
}
/* hai khối thẻ (thể loại, tính năng): nền xám nhạt để thẻ trắng nổi lên */
.background-responsive {
    background-color: var(--background-color);
}

.pattern {
    position: absolute;
    width: 100vw;
    height: 300px;
    background-size: cover;
    background-repeat: no-repeat;
    left: 0;
    pointer-events: none;
}

.pattern-top {
    top: 0;
    transform: rotate(180deg);
}

.pattern-bottom {
    bottom: 0;
}

.eclipse {
    width: 300px;
    height: 300px;
    border-radius: 300px;
    filter: blur(250px);
    animation: colorShift 5s ease-in-out infinite alternate;
}

.eclipse-left {
    background: var(--background-sub-color1);
}
.eclipse-right {
    background: var(--background-sub-color2);
}

@keyframes colorShift {
    0% {
        background: var(--background-sub-color1);
    }
    25% {
        background: #b956a2;
    }
    50% {
        background: var(--background-sub-color2);
    }
    75% {
        background: #b956a2;
    }
    100% {
        background: var(--background-sub-color1);
    }
}

.content-container {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.home-content-item {
    text-align: center;
    margin: 15px 0px;
    color: var(--text-color);
}

.home-content-item:first-child {
    border-radius: 999px;
    background: var(--main-color);
    color: var(--text-color-contrast);
    display: inline-flex;
    padding: 4px 12px;
    justify-content: center;
    align-items: center;
    gap: 12px;
}
.home-content-item:nth-child(2) {
    font-family: inherit;
    font-size: 60px;
    font-style: normal;
    font-weight: 700;
    line-height: normal;
}
.home-content-item:nth-child(2) span {
    background: var(--background-color-gradient);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    color: var(--text-color);
}
.home-content-item:nth-child(3) {
    width: 600px;
}
.home-content-item:nth-child(4) a {
    display: inline-flex;
    height: 44px;
    padding: 0 24px;
    justify-content: center;
    align-items: center;
    text-decoration: none;
    border-radius: var(--ui-r-md);
    background-color: var(--content-item-background-color);
    border: 1px solid var(--main-color);
    margin: 0 8px;
    color: var(--c-primary-text);
    font-size: 14px;
    font-weight: 600;
    transition: all 0.2s ease-in-out;
}

.home-content-item:nth-child(4) a:nth-child(2):hover {
    background-color: var(--main-color);
    color: var(--text-color-contrast);
}

.home-content-item:nth-child(4) a:first-child {
    background: linear-gradient(97deg, #5813c1 -5.8%, #c45037 99.69%);
    color: #fff;
    background-size: 200% 200%;
    background-position: 0% 50%;
    transition: background-position 0.3s ease-in;
    border-color: transparent;
}
.home-content-item:nth-child(4) a:first-child:hover {
    background-position: 50% 100%;
}

.category-item-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
}

.home-content-item:nth-child(4) {
    width: 100vw;
    padding: 0px 20px;
}

.category-item {
    display: flex;
    width: calc(100vw / 3 - 50px);
    padding: 16px;
    margin: 8px;
    border-radius: var(--ui-r-xl);
    border: 1px solid var(--content-item-border-color);
    background: var(--content-item-background-color);
    transition: border-color 0.15s ease;
}
.category-item:hover,
.feature-item:hover {
    border-color: var(--main-color);
}

.category-item-icon {
    display: flex;
    width: 50px;
    height: 50px;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
    aspect-ratio: 1/1;
    font-size: 30px;
    border-radius: 50%;
    margin: 8px;
}

.category-item:nth-child(1) i {
    background-color: var(--category-1st-color);
}
.category-item:nth-child(1) a {
    color: var(--category-1st-color);
}

.category-item:nth-child(2) i {
    background-color: var(--category-2st-color);
}
.category-item:nth-child(2) a {
    color: var(--category-2st-color);
}

.category-item:nth-child(3) i {
    background-color: var(--category-3st-color);
}
.category-item:nth-child(3) a {
    color: var(--category-3st-color);
}

.category-item:nth-child(4) i {
    background-color: var(--category-4st-color);
}
.category-item:nth-child(4) a {
    color: var(--category-4st-color);
}

.category-item:nth-child(5) i {
    background-color: var(--category-5st-color);
}
.category-item:nth-child(5) a {
    color: var(--category-5st-color);
}

.category-item:nth-child(6) i {
    background-color: var(--category-6st-color);
}
.category-item:nth-child(6) a {
    color: var(--category-6st-color);
}

.category-item-content {
    text-align: start;
    margin-left: 10px;
}

.category-item-content span:nth-child(1) {
    font-size: 18px;
    font-style: normal;
    font-weight: 700;
    line-height: normal;
}

.category-item-content span:nth-child(3) {
    color: var(--text-color);
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
}
.category-item-content a {
    height: auto !important;
    padding: 0 !important;
    background-color: transparent !important;
    margin: 0 !important;
    margin-top: 10px !important;
    font-size: 14px !important;
    align-items: center !important;
    justify-content: start !important;
    text-align: center !important;
    font-weight: 600 !important;
    border-color: transparent !important;
}

.category-item-content i {
    background-color: transparent !important;
    transform: translateY(1px);
    font-size: 18px;
}

.feature-item-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-around;
}

.feature-item {
    display: flex;
    width: calc(100vw / 3 - 50px);
    padding: 16px;
    margin: 8px;
    border-radius: var(--ui-r-xl);
    flex-direction: column;
    justify-content: start;
    align-items: start;

    border: 1px solid var(--content-item-border-color);
    background: var(--content-item-background-color);
    transition: border-color 0.15s ease;
}

.feature-item-icon {
    display: flex;
    width: 50px;
    height: 50px;
    justify-content: center;
    align-items: center;
    flex-shrink: 0;
    aspect-ratio: 1/1;
    font-size: 25px;
    border-radius: 50%;
    margin: 8px;
}

.feature-item:nth-child(1) i {
    background-color: color-mix(in srgb, var(--category-1st-color) 16%, var(--c-surface));
    color: var(--category-1st-color);
}
.feature-item:nth-child(2) i {
    background-color: color-mix(in srgb, var(--category-2st-color) 16%, var(--c-surface));
    color: var(--category-2st-color);
}
.feature-item:nth-child(3) i {
    background-color: color-mix(in srgb, var(--category-3st-color) 16%, var(--c-surface));
    color: var(--category-3st-color);
}
.feature-item:nth-child(4) i {
    background-color: color-mix(in srgb, var(--category-4st-color) 16%, var(--c-surface));
    color: var(--category-4st-color);
}
.feature-item:nth-child(5) i {
    background-color: color-mix(in srgb, var(--category-5st-color) 16%, var(--c-surface));
    color: var(--category-5st-color);
}
.feature-item:nth-child(6) i {
    background-color: color-mix(in srgb, var(--category-6st-color) 16%, var(--c-surface));
    color: var(--category-6st-color);
}

.banner {
    width: calc(100% - 65px);
    border-radius: var(--ui-r-xl);
    background: linear-gradient(97deg, #5813c1 -5.8%, #c45037 99.69%);
    padding: 30px;
    display: flex;
    justify-content: space-between;
}
.banner-item div {
    margin: 16px 0px;
}
.banner-item div:nth-child(1) {
    width: 400px;
    color: #fff;
    font-size: 36px;
    font-style: normal;
    font-weight: 700;
    line-height: normal;
}

.banner-item div:nth-child(2) {
    width: 550px;
    color: #fff;
    font-size: 18px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
}

.banner-item a {
    display: inline-flex;
    height: 44px;
    padding: 0 24px;
    justify-content: center;
    align-items: center;
    margin-right: 15px;
    background-color: var(--background-color-contrast);
    border-radius: var(--ui-r-md);
    color: var(--c-page);
    text-decoration: none;
    font-size: 14px;
    font-weight: 600;
}

.banner-item a:nth-child(2) {
    background-color: transparent;
    border: 2px solid #fff;
    color: #fff;
}
.banner-item a:nth-child(1):hover {
    opacity: 0.8;
}

.banner-item-img {
    width: 700px;
    height: 220px;
    background-size: cover;
    background-position: center;
    border-radius: var(--ui-r-lg);
    padding: 0 350px;
}

@media screen and (max-width: 600px) {
    .home-content-item:nth-child(2) {
        font-size: 30px;
    }
    .home-content-item:nth-child(3) {
        width: 400px;
    }
    .category-item {
        width: calc(100vw / 1 - 50px);
    }
    .feature-item {
        width: calc(100vw / 1 - 50px);
        display: flex;
        flex-direction: row;
    }

    .background-responsive {
        height: 135vh;
    }

    .banner {
        flex-direction: row;
        justify-content: center;
    }

    .banner-item div:nth-child(1) {
        font-size: 32px;
        width: 300px;
    }
    .banner-item div:nth-child(2) {
        width: 300px;
    }

    .banner-item a {
        display: flex;
        margin-bottom: 10px;
    }

    .banner-item-img {
        display: none;
    }
}
</style>
