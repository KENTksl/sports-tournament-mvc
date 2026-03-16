# Sports Tournament MVC

Ứng dụng web quản lý giải đấu phong trào (tập trung vào Bóng đá), xây dựng theo mô hình Controller → Service → Repository, giao diện EJS, lưu trữ dữ liệu bằng MongoDB (Mongoose).

## Tính năng chính

- Trang người dùng: Home/About/Contact, tin tức từ RSS, danh sách giải đấu bóng đá và trang chi tiết giải.
- Đăng ký tài khoản/đăng nhập bằng JWT.
- Hồ sơ cá nhân: xem/cập nhật thông tin, upload avatar, quản lý “đội của tôi”, theo dõi lịch & kết quả các trận liên quan, export lịch thi đấu dạng `.ics`.
- Đăng ký hồ sơ đội tuyển cho giải (kèm logo, thành viên, ảnh CCCD).
- Trang quản trị:
  - Quản lý giải đấu (Bóng đá và các môn khác): tạo/sửa/xóa, upload ảnh giải.
  - Quản lý giải bóng đá: thêm đội (từ hồ sơ đã duyệt), thêm cầu thủ, tạo lịch thi đấu, validate trùng sân & thời gian nghỉ, bắt đầu giải, tạo bracket Knockout.
  - Quản lý trận đấu: cập nhật tỉ số, đội hình, sự kiện (bàn thắng/thẻ), đồng bộ tiền phạt theo thẻ.
  - Quản lý tiền phạt: thẻ vàng/thẻ đỏ, trạng thái thanh toán.

## Công nghệ sử dụng

- Backend: Node.js, Express, Socket.IO
- View: EJS
- Database: MongoDB Atlas + Mongoose
- Auth: bcrypt, jsonwebtoken (JWT)
- Upload: multer
- Tin tức: rss-parser

## Yêu cầu

- Node.js 18+ (khuyến nghị)
- Tài khoản MongoDB Atlas và quyền truy cập cluster `cluster0.u5scqoz.mongodb.net` (đang được hard-code trong [app.js](file:///c:/Users/acer/Desktop/sports-tournament-mvc/app.js#L9-L15))

## Cài đặt & chạy

1. Cài dependencies:

   ```bash
   npm install
   ```

2. Cấu hình MongoDB/JWT trong [Config/Setting.json](file:///c:/Users/acer/Desktop/sports-tournament-mvc/Config/Setting.json):

   ```json
   {
     "mongodb": {
       "username": "YOUR_MONGODB_USER",
       "password": "YOUR_MONGODB_PASSWORD",
       "database": "YOUR_DATABASE_NAME"
     },
     "jwt": {
       "secret": "YOUR_JWT_SECRET"
     }
   }
   ```

3. Chạy server:

   ```bash
   npm start
   ```

4. Mở trình duyệt:
   - http://localhost:3000

Ghi chú:
- Có thể đổi port bằng biến môi trường `PORT` (mặc định `3000`).
- Static files được phục vụ qua prefix `/static` (ví dụ ảnh upload: `/static/uploads/...`).

## Cấu trúc thư mục

```
.
├─ app.js                      # Entry point (Express + MongoDB + Socket.IO)
├─ Config/
│  └─ Setting.json             # MongoDB credentials + JWT secret
├─ apps/
│  ├─ controllers/             # Router/controller theo module (admin, football, api...)
│  ├─ services/                # Business logic
│  ├─ repositories/            # Truy vấn DB qua Mongoose
│  ├─ models/                  # Mongoose schemas
│  ├─ views/                   # EJS templates
│  └─ common/                  # constants (mode/status, fine, auth...)
├─ public/                     # assets + uploads (đi qua /static)
└─ scripts/                    # script hỗ trợ vận hành
```

## Các route chính

### Giao diện (EJS)

- `/` hoặc `/home`: Trang chủ
- `/about`, `/contact`
- `/news`: Tin tức (RSS)
- `/football`: Danh sách giải bóng đá
- `/football/detail/:id`: Chi tiết giải bóng đá
- `/register-team`: Form gửi hồ sơ đội tuyển  
  - Có thể truyền `?tournamentId=<id>` để gắn hồ sơ vào giải cụ thể
- `/login`, `/signup`, `/profile`
- `/admin`: Dashboard quản trị

### API (JSON)

- `POST /authenticate/register`: đăng ký tài khoản
- `POST /authenticate/login`: đăng nhập, trả về `{ token, roles }`
- `GET /authenticate/test-security`: test JWT (yêu cầu header `Authorization: Bearer <token>`)

### API (cần JWT)

- `GET /profile/data`: lấy dữ liệu hồ sơ + registrations + fines (header `Authorization: Bearer <token>`)
- `POST /profile/update`: cập nhật profile (multipart/form-data, field `avatar`)

## Uploads

- Avatar: `public/uploads/avatars` → truy cập `/static/uploads/avatars/<filename>`
- Ảnh giải/logo đội/ảnh thành viên (một phần): `public/uploads/tournaments` → `/static/uploads/tournaments/<filename>`

## Realtime (Socket.IO)

Ứng dụng đã khởi tạo Socket.IO và phân “room” theo giải/trận:

- `tournament:<tournamentId>`
- `match:<matchId>`

Phần giao diện có lắng nghe các event như `match_updated`, `bracket_updated`, `standings_updated`. Hiện tại phía server mới xử lý việc join room trong [app.js](file:///c:/Users/acer/Desktop/sports-tournament-mvc/app.js#L44-L50), chưa có phần broadcast cập nhật từ backend.

## Script tiện ích

- Sửa trạng thái giải bóng đá bị sai (completed nhưng chưa có/hoặc chưa xong trận):

  ```bash
  node scripts/fix_tournament_status.js
  ```

## Lưu ý vận hành & bảo mật

- [Config/Setting.json](file:///c:/Users/acer/Desktop/sports-tournament-mvc/Config/Setting.json) đang chứa credential/JWT secret. Không nên dùng giá trị thật trong môi trường production và không nên commit secret.
- Các trang `/admin` hiện chưa có middleware bảo vệ theo role; nên bổ sung kiểm soát truy cập nếu triển khai thực tế.
- Repo chưa có test script (mặc định `npm test` sẽ báo lỗi).

## Tác giả

- Nguyễn Huỳnh Quang Minh (2280601945)
- Đỗ Thành Nhân (2280602162)
