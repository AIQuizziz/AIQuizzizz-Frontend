const n=`AIQuizzizz hỗ trợ 5 loại câu hỏi. Bạn chọn loại bằng ô chọn ở đầu mỗi câu khi soạn bộ câu hỏi; mỗi câu trong cùng một bộ có thể thuộc loại khác nhau.

## Tổng quan

| Loại | Mô tả | Giới hạn chính |
| --- | --- | --- |
| **Trắc nghiệm** (*Multiple choice*) | Một hoặc nhiều lựa chọn đúng | 2–10 lựa chọn, ít nhất 1 đáp án đúng |
| **Ghép đôi** (*Matching*) | Các cặp vế trái – vế phải | 2–10 cặp |
| **Sắp xếp** (*Ordering*) | Các mục cần xếp đúng thứ tự | 2–10 mục |
| **Tự luận ngắn** (*Short text*) | Một đáp án dạng chữ | 1 đáp án, tối đa 1000 ký tự |
| **Thẻ ghi nhớ ngôn ngữ** (*Language flashcard*) | Thẻ từ vựng hai mặt | Tối đa 5 nghĩa mỗi thẻ |

Mỗi lựa chọn, vế ghép hoặc mục sắp xếp tối đa 1000 ký tự và không được để trống.

## Trắc nghiệm

1. Nhập nội dung từng lựa chọn trong **Lựa chọn đáp án** (*Answer options*). Câu mới có sẵn 4 ô lựa chọn.
2. Đánh dấu ô vuông trước mỗi lựa chọn đúng. Bạn có thể đánh dấu nhiều lựa chọn.
3. Bấm **Thêm lựa chọn** (*Add option*) để thêm, hoặc biểu tượng dấu trừ để xóa một lựa chọn.

> [!WARNING]
> Các lựa chọn không được trùng nội dung. Việc so sánh phân biệt chữ hoa và chữ thường, ví dụ \`a\` và \`A\` được coi là khác nhau.

## Ghép đôi

1. Mỗi dòng là một cặp đúng: nhập vế trái và vế phải.
2. Bấm biểu tượng hai mũi tên giữa hai vế để hoán đổi chúng.
3. Bấm **Thêm cặp** (*Add pair*) để thêm cặp mới.

## Sắp xếp

Nhập các mục **theo đúng thứ tự** từ trên xuống dưới. Thứ tự bạn nhập chính là đáp án đúng. Bấm **Thêm lựa chọn** để thêm mục.

## Tự luận ngắn

1. Nhập đáp án vào ô **Đáp án** (*Answer text*).
2. Mục **Đáp án hợp lệ** (*Valid answers*) hiển thị các cách viết của đáp án (chữ thường, chữ hoa, viết hoa chữ cái đầu) để bạn tham khảo cách người học có thể nhập.

## Thẻ ghi nhớ ngôn ngữ

Loại này dùng để học từ vựng. Thẻ có hai mặt:

- **Mặt trước (từ hoặc cụm từ)** (*Front (word or phrase)*): bắt buộc, chỉ là chữ thường, không định dạng.
- **Mặt sau của thẻ** (*Back of the card*): không bắt buộc. Gồm **Phiên âm** (*Phonetic*) và danh sách **Các nghĩa** (*Meanings*).

Mỗi nghĩa gồm **Từ loại** (*Part of speech*), **Định nghĩa** (*Definition*), **Bản dịch** (*Translation*) và tối đa 3 **Ví dụ** (*Examples*). Mỗi nghĩa cần có ít nhất định nghĩa hoặc bản dịch. Bấm **Thêm nghĩa** (*Add meaning*) để thêm, tối đa 5 nghĩa.

> [!NOTE]
> Thẻ chưa có nghĩa nào vẫn được lưu như thẻ nháp. Loại câu hỏi này không có phần giải thích, không hỗ trợ Markdown và không đính kèm được ảnh/video.

## Đổi loại câu hỏi

Khi đổi loại, nội dung câu hỏi được giữ lại. Nếu loại mới chưa có đáp án, hệ thống tạo sẵn các ô trống mặc định. Khi đổi sang Thẻ ghi nhớ ngôn ngữ, nội dung câu hỏi được chuyển thành chữ thường (mất định dạng).

## Xem thêm

- [Tạo bộ câu hỏi](/guide/question-sets/create)
- [Rich text & Markdown](/guide/question-sets/markdown)
- [Nhập / xuất câu hỏi](/guide/question-sets/import)
- [Chế độ Học](/guide/learning/learn-mode)
`;export{n as default};
