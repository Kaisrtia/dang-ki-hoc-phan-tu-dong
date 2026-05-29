# DUT course register helper

Script Playwright thao tác trên giao diện web thật, không gọi API ẩn và không bypass đăng nhập.

## Chạy

```powershell
npm start
```

Lần đầu chạy, cửa sổ Brave/Chrome sẽ mở profile riêng tại `.dut-register-profile`. Nếu chưa đăng nhập, hãy đăng nhập thủ công trong cửa sổ đó. Sau khi thấy phiên đăng nhập, script sẽ tự bắt đầu.

## Cấu hình nhanh

```powershell
$env:RETRY_DELAY_MS="500"; npm start
```

Các biến có thể đổi:

- `COURSE_CODE`: mặc định `2100010`
- `SECTION_CODE`: mặc định `2100010.2521.yy.94`
- `RETRY_DELAY_MS`: mặc định `1000`
- `ACTION_DELAY_MS`: mặc định `300`
- `MAX_ATTEMPTS`: mặc định `0`, nghĩa là chạy đến khi thành công hoặc bạn nhấn `Ctrl+C`
- `BROWSER_PATH`: đường dẫn browser Chromium nếu muốn chỉ định thủ công

Ví dụ:

```powershell
$env:COURSE_CODE="2100010"
$env:SECTION_CODE="2100010.2521.yy.94"
$env:RETRY_DELAY_MS="500"
$env:ACTION_DELAY_MS="200"
npm start
```

## Đổi học phần và lớp học phần

Nếu workflow vẫn giống như hiện tại nhưng bạn muốn đăng ký môn/lớp khác, chỉ cần đổi 2 mã:

- `COURSE_CODE`: mã học phần ở bảng "Lớp chọn riêng", ví dụ `2100010`
- `SECTION_CODE`: mã lớp học phần trong bảng chi tiết sau khi bấm "Chi tiết", ví dụ `2100010.2521.yy.94`

Cách khuyến nghị là truyền biến môi trường trước khi chạy:

```powershell
$env:COURSE_CODE="MA_HOC_PHAN"
$env:SECTION_CODE="MA_LOP_HOC_PHAN"
npm start
```

Ví dụ đăng ký học phần `1180933`, lớp `1180933.2521.yy.94`:

```powershell
$env:COURSE_CODE="1180933"
$env:SECTION_CODE="1180933.2521.yy.94"
npm start
```

Nếu muốn đổi luôn giá trị mặc định trong code, mở file `register-helper.cjs` và sửa 2 dòng trong phần `CONFIG`:

```js
courseCode: process.env.COURSE_CODE || "2100010",
sectionCode: process.env.SECTION_CODE || "2100010.2521.yy.94",
```

Ví dụ:

```js
courseCode: process.env.COURSE_CODE || "1180933",
sectionCode: process.env.SECTION_CODE || "1180933.2521.yy.94",
```

Lưu ý: `COURSE_CODE` phải là mã ở bảng phase 1, còn `SECTION_CODE` phải là mã đầy đủ ở bảng phase 2. Nếu nhập sai một trong hai mã, script sẽ không tìm thấy đúng hàng để bấm.

## Logic dừng

Script dừng khi:

- bảng "Các lớp bạn đã đăng ký/đang được xử lý" có trạng thái `Đã đăng ký`; hoặc
- không còn thấy học phần `COURSE_CODE` trong bảng "Lớp chọn riêng", theo workflow đã mô tả là đã đăng ký thành công.
