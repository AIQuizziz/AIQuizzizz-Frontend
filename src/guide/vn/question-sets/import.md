Thay vì gõ từng câu, bạn có thể nhập nhiều câu hỏi cùng lúc từ tệp Excel hoặc từ JSON. JSON có thể do bạn tự viết, xuất từ một bộ câu hỏi khác, hoặc do AI (ChatGPT, Gemini, Claude…) tạo theo prompt mẫu. Hệ thống đọc dữ liệu, phân loại câu hợp lệ và không hợp lệ để bạn chọn câu muốn nhập.

## Mở hộp thoại nhập

Ở trang tạo hoặc chỉnh sửa bộ câu hỏi, bấm **Nhập** (*Import*) trong phần **Câu hỏi trong bộ câu hỏi** (*Quiz Questions*). Hộp thoại **Nhập câu hỏi** (*Import Questions*) mở ra. Chọn nguồn **Excel** hoặc **JSON** ở đầu hộp thoại.

## Nhập từ Excel

### Chuẩn bị tệp

1. Bấm **Tải xuống mẫu** (*Download template*) để tải tệp mẫu.
2. Điền câu hỏi vào tệp mẫu, mỗi dòng một câu. Giữ nguyên tên các cột.
3. Lưu tệp ở định dạng XLS hoặc XLSX.

| Cột | Cách điền |
| --- | --- |
| Question Type | Bắt buộc. Một trong các giá trị `MultipleChoice`, `Matching`, `Ordering`, `ShortText`, viết đúng như vậy. |
| Question Text | Bắt buộc. Nội dung câu hỏi. |
| Score | Bắt buộc. Số điểm từ 0 đến 999. |
| Text Format | Không bắt buộc. `PlainText`, `Html` hoặc `Markdown`. |
| Option 1 … Option 10 | Đáp án, cách điền tùy loại câu hỏi (xem bên dưới). |

Cách điền cột Option theo từng loại:

- **Trắc nghiệm**: mỗi ô là một lựa chọn. Thêm dấu `*` ở đầu lựa chọn đúng, ví dụ `*Hà Nội`.
- **Ghép đôi**: Option 1 và Option 2 là một cặp, Option 3 và Option 4 là cặp tiếp theo, và cứ thế.
- **Sắp xếp**: điền các mục theo đúng thứ tự.
- **Tự luận ngắn**: điền đáp án vào một ô Option.

> [!NOTE]
> Tệp nhập không có cột giải thích và không hỗ trợ loại Thẻ ghi nhớ ngôn ngữ. Bạn có thể thêm giải thích hoặc thẻ sau khi nhập.

### Tải tệp lên và xem trước

1. Trong mục **Tải lên tệp** (*Upload File*), bấm vào khung tải lên hoặc kéo tệp vào. Mỗi lần chỉ tải một tệp.
2. Khi đọc xong, mục **Xem trước** (*Preview*) liệt kê các câu hỏi trong tệp.
3. Dùng ô lọc để xem **Tất cả** (*All*), **Hợp lệ** (*Valid*) hoặc **Không hợp lệ** (*Invalid*). Câu không hợp lệ được đánh dấu riêng.
4. Bấm mũi tên ở mỗi câu để xem đáp án.

Một câu bị coi là không hợp lệ khi sai loại câu hỏi, thiếu nội dung, điểm không hợp lệ hoặc đáp án không đạt quy tắc của loại đó. Xem [Các loại câu hỏi](/guide/question-sets/question-types).

> [!WARNING]
> Nếu tệp không đúng định dạng hoặc thiếu cột bắt buộc, hệ thống báo lỗi và không đọc tệp. Hãy dùng đúng tệp mẫu.

## Nhập từ JSON

1. Chọn nguồn **JSON**.
2. Dán JSON vào ô nhập, bấm **Chọn tệp .json**, hoặc kéo tệp `.json` vào ô nhập.
3. Bấm **Kiểm tra JSON**. Mục **Xem trước** liệt kê các câu hỏi, các câu hợp lệ được chọn sẵn.
4. Câu không hợp lệ có viền đỏ và ghi lý do ngay dưới câu, ví dụ "Phải có ít nhất một lựa chọn đúng". Sửa JSON rồi kiểm tra lại, hoặc nhập rồi sửa trong trình soạn thảo.

Bạn có thể dán nguyên câu trả lời của AI. Hệ thống tự bỏ lời dẫn và khối ` ```json `, chấp nhận dấu phẩy thừa ở cuối danh sách.

Ở trang tạo bộ câu hỏi, nếu JSON có `questionSet` thì tên, mô tả và thẻ được điền vào các ô **còn trống**. Ô bạn đã nhập được giữ nguyên.

### Cấu trúc JSON

Bấm **Tải JSON mẫu** để có tệp mẫu đủ 4 loại câu hỏi.

```json
{
  "format": "aiquizzizz/questions",
  "version": 1,
  "questionSet": { "name": "Hệ Mặt Trời", "description": "Kiến thức cơ bản", "tags": ["thiên văn"] },
  "questions": [
    {
      "type": "MultipleChoice",
      "content": "Hành tinh nào lớn nhất?",
      "points": 1,
      "explanation": "Sao Mộc có đường kính lớn nhất.",
      "options": [
        { "text": "Sao Thổ", "correct": false },
        { "text": "Sao Mộc", "correct": true }
      ]
    },
    { "type": "Matching", "content": "Nối hành tinh với đặc điểm", "pairs": [ { "left": "Sao Hoả", "right": "Hành tinh đỏ" }, { "left": "Sao Thổ", "right": "Có vành đai" } ] },
    { "type": "Ordering", "content": "Xếp theo khoảng cách tới Mặt Trời", "items": ["Sao Thuỷ", "Sao Kim", "Trái Đất"] },
    { "type": "ShortText", "content": "Vệ tinh của Trái Đất?", "answer": "Mặt Trăng" }
  ]
}
```

| Trường | Cách điền |
| --- | --- |
| `type` | Bắt buộc. `MultipleChoice`, `Matching`, `Ordering` hoặc `ShortText`. Thiếu thì hệ thống đoán theo các trường đáp án. |
| `content` | Bắt buộc. Nội dung câu hỏi, tối đa 5000 ký tự. |
| `points` | Không bắt buộc. Số điểm từ 0 đến 999. Thiếu thì lấy 10. |
| `explanation` | Không bắt buộc. Giải thích đáp án. |
| `textFormat` | Không bắt buộc. `PlainText`, `Html` hoặc `Markdown`. |
| `options` | Trắc nghiệm. 2–10 lựa chọn `{ "text", "correct" }`, ít nhất một lựa chọn đúng. |
| `pairs` | Ghép đôi. Ít nhất 2 cặp `{ "left", "right" }`. |
| `items` | Sắp xếp. Ít nhất 2 mục, liệt kê theo **thứ tự đúng**. Hệ thống tự xáo trộn khi làm bài. |
| `answer` | Tự luận ngắn. Một đáp án. Nếu có nhiều đáp án, hệ thống lấy đáp án đầu và cảnh báo. |

Mỗi lần nhập tối đa 500 câu. Ảnh / video không nhập qua JSON, hãy thêm sau khi nhập. Xem [Ảnh / video trong câu hỏi](/guide/question-sets/media).

### Dùng AI tạo JSON (prompt mẫu)

1. Ở nguồn **JSON**, bấm **Prompt mẫu để AI tạo JSON**.
2. Điền chủ đề, số câu, độ khó, ngôn ngữ câu hỏi, các loại câu hỏi và yêu cầu thêm (nếu có).
3. Bấm **Sao chép prompt**, dán vào ChatGPT, Gemini, Claude… Bạn có thể đính kèm tài liệu để AI soạn theo.
4. Sao chép toàn bộ câu trả lời của AI, dán vào ô JSON rồi bấm **Kiểm tra JSON**.

> [!WARNING]
> AI có thể đưa ra đáp án sai. Hãy đọc lại từng câu và đáp án trước khi lưu bộ câu hỏi.

## Chọn câu và nhập

1. Đánh dấu các câu muốn nhập, hoặc dùng **Chọn tất cả** (*Check all*).
2. Bấm **Nhập** ở cuối hộp thoại, rồi bấm **OK** trong hộp xác nhận.
3. Các câu được thêm vào đầu danh sách câu hỏi. Câu trống mặc định (chưa nhập gì) được bỏ đi.
4. Kiểm tra lại các câu vừa nhập, rồi lưu bộ câu hỏi.

> [!TIP]
> Bạn vẫn có thể chọn nhập câu không hợp lệ, nhưng phải sửa chúng trong trình soạn thảo trước khi lưu. Tổng số câu sau khi nhập không được vượt quá 500.

## Xuất câu hỏi ra JSON

Ở trang chi tiết bộ câu hỏi, bấm biểu tượng **Xuất JSON** cạnh nút sửa. Trình duyệt tải về tệp `.json` gồm tên, mô tả, thẻ và toàn bộ câu hỏi theo đúng thứ tự. Bạn có thể sửa tệp này rồi nhập lại vào bộ khác.

- Chỉ người có quyền sửa bộ câu hỏi mới xuất được.
- Nếu bạn không phải chủ bộ (chỉ được chia sẻ quyền sửa), gói của bạn phải cho phép sao chép bộ câu hỏi.
- Ảnh / video của câu hỏi không có trong tệp xuất.

## Xem thêm

- [Tạo bộ câu hỏi](/guide/question-sets/create)
- [Các loại câu hỏi](/guide/question-sets/question-types)
- [Rich text & Markdown](/guide/question-sets/markdown)
