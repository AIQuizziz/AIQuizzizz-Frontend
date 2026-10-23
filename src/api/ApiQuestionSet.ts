import Api from "@/api/Api";
import type QuestionSetPublicPageParams from "@/models/request/question_set/publicPageParams";
import type QuestionSetPageParams from "@/models/request/question_set/questionSetPageParams";

import qs from "qs";

const END_POINTS = {
    CREATE: "QuestionSet",
    UPDATE: "QuestionSet/{questionSetId}",
    LEARN_QUESTIONS: "QuestionSet/{questionSetId}/LearnQuestions",
    LEARN_HISTORY: "QuestionSet/{questionSetId}/LearnHistory",
    DELETE_LEARN_HISTORY: "QuestionSet/{questionSetId}/LearnHistory",
    GET_DETAIL_BY_ID: "QuestionSet/{questionSetId}",
    GET_QUESTIONS_BY_ID: "QuestionSet/{questionSetId}/Questions",
    GET_RECENT_BY_LIMIT: "QuestionSet/Recent",
    GET_PUBLIC_BY_LIMIT: "QuestionSet/Public",
    GET_ALL_BY_LIMIT: "QuestionSet/SharedOrOwned",
    DELETE: "QuestionSet/{questionSetId}",
    GET_PERMISSION: "QuestionSet/{questionSetId}/Permissions",
    TEST_QUESTION: "QuestionSet/{questionSetId}/Test",
    GET_SHARING: "QuestionSet/{questionSetId}/Sharing",
    UPDATE_SHARING: "QuestionSet/{questionSetId}/Sharing",
    GET_RATING: "QuestionSet/{questionSetId}/Rating",
    UPDATE_RATING: "QuestionSet/{questionSetId}/Rating",
    GET_SHARED_CLASSES: "QuestionSet/{questionSetId}/Classes",
    DOWNLOAD_FILE_IMPORT: "QuestionSet/DownloadFileImport",
    GET_QUIZ_TYPES: "QuestionSet/{questionSetId}/Types",
    EXPORT_JSON: "QuestionSet/{questionSetId}/ExportJson",
    IMPORT_JSON: "QuestionSet/ImportJson",
};

class ApiQuestionSet {
    Create = async (formState: object) => {
        return await Api.post(`${END_POINTS.CREATE}`, formState);
    };

    Update = async (questionSetId: string, formState: object) => {
        const url = END_POINTS.UPDATE.replace("{questionSetId}", questionSetId);
        return await Api.patch(url, formState);
    };

    Delete = async (questionSetId: string) => {
        const url = END_POINTS.DELETE.replace("{questionSetId}", questionSetId);
        return await Api.delete(url);
    };

    LearnQuestions = async (questionSetId: string, questionCount: number) => {
        const url = END_POINTS.LEARN_QUESTIONS.replace("{questionSetId}", questionSetId);
        return await Api.get(url, { params: { questionCount } });
    };

    LearnHistory = async (questionSetId: string, leanrHistory: any[]) => {
        const url = END_POINTS.LEARN_HISTORY.replace("{questionSetId}", questionSetId);
        return await Api.post(url, leanrHistory);
    };

    resetLearnHistory = async (questionId: string) => {
        const url = END_POINTS.DELETE_LEARN_HISTORY.replace("{questionSetId}", questionId);
        return await Api.delete(url);
    };

    GetDetailById = async (questionSetId: string) => {
        const url = END_POINTS.GET_DETAIL_BY_ID.replace("{questionSetId}", questionSetId);
        return await Api.get(url);
    };

    GetQuestionById = async (questionSetId: string) => {
        const url = END_POINTS.GET_QUESTIONS_BY_ID.replace("{questionSetId}", questionSetId);
        return await Api.get(url);
    };

    GetRecentByLimit = async (pageParams: QuestionSetPublicPageParams) => {
        return await Api.get(`${END_POINTS.GET_RECENT_BY_LIMIT}`, {
            params: {
                pageNumber: pageParams.pageNumber <= 0 ? 1 : pageParams.pageNumber,
                pageSize: Math.max(5, Math.min(pageParams.pageSize || 5, 100)),
            },
        });
    };

    GetPublicByLimit = async (pageParams: QuestionSetPublicPageParams) => {
        return await Api.get(`${END_POINTS.GET_PUBLIC_BY_LIMIT}`, {
            params: {
                pageNumber: pageParams.pageNumber <= 0 ? 1 : pageParams.pageNumber,
                pageSize: Math.max(5, Math.min(pageParams.pageSize || 5, 100)),
                name: pageParams.name?.toLowerCase() || "",
                tagIds: pageParams.tagIds || [],
                sortBy: pageParams.sortBy || "",
            },
            paramsSerializer: (params) => qs.stringify(params, { arrayFormat: "repeat" }),
        });
    };

    GetAllByLimit = async (pageParams: QuestionSetPageParams) => {
        return await Api.get(`${END_POINTS.GET_ALL_BY_LIMIT}`, {
            params: {
                pageNumber: pageParams.pageNumber <= 0 ? 1 : pageParams.pageNumber,
                pageSize: Math.max(5, Math.min(pageParams.pageSize || 5, 100)),
                name: pageParams.name.toLowerCase() || "",
                filterBy: pageParams.filterBy || "",
            },
        });
    };

    GetPermissions = async (questionSetId: string) => {
        const url = END_POINTS.GET_PERMISSION.replace("{questionSetId}", questionSetId);
        return await Api.get(url);
    };

    TestQuestions = async (
        questionSetId: string,
        numberOfQuestion: number,
        questionTypes: string,
    ) => {
        const url = END_POINTS.TEST_QUESTION.replace("{questionSetId}", questionSetId);
        return await Api.get(url, {
            params: {
                numberOfQuestion: numberOfQuestion,
                questionTypes: questionTypes,
            },
        });
    };

    GetSharedUser = async (questionSetId: string) => {
        const url = END_POINTS.GET_SHARING.replace("{questionSetId}", questionSetId);
        return await Api.get(url);
    };

    UpdateSharedUser = async (formState: any) => {
        const url = END_POINTS.UPDATE_SHARING.replace("{questionSetId}", formState.id);
        return await Api.patch(url, formState);
    };

    GetRating = async (questionSetId: string) => {
        const url = END_POINTS.GET_RATING.replace("{questionSetId}", questionSetId);
        return await Api.get(url);
    };

    UpdateRating = async (questionSetId: string, formState: any) => {
        const url = END_POINTS.UPDATE_RATING.replace("{questionSetId}", questionSetId);
        return await Api.post(url, formState);
    };

    GetSharedClasses = async (questionSetId: string) => {
        const url = END_POINTS.GET_SHARED_CLASSES.replace("{questionSetId}", questionSetId);
        return await Api.get(url);
    };

    DownloadFileImport = async () => {
        return await Api.get(`${END_POINTS.DOWNLOAD_FILE_IMPORT}`);
    };

    // JSON câu hỏi của bộ (định dạng "aiquizzizz/questions")
    ExportJson = async (questionSetId: string) => {
        const url = END_POINTS.EXPORT_JSON.replace("{questionSetId}", questionSetId);
        return await Api.get(url);
    };

    // đọc + kiểm tra JSON câu hỏi (không lưu): trả câu hợp lệ / không hợp lệ kèm lý do
    ImportJson = async (json: string) => {
        return await Api.post(END_POINTS.IMPORT_JSON, { json });
    };

    GetQuizTypes = async (questionSetId: string) => {
        const url = END_POINTS.GET_QUIZ_TYPES.replace("{questionSetId}", questionSetId);
        return await Api.get(url);
    };
}

export default new ApiQuestionSet();
