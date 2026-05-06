# Online Banking System

Đây là một dự án mẫu mô phỏng dịch vụ tiết kiệm trên blockchain. Người dùng gửi token vào smart contract, nhận một NFT đại diện cho khoản gửi, sau đó có thể rút tiền khi đến hạn hoặc gia hạn sang kỳ mới.

## Dự án này làm gì?

- Cho phép tạo các gói tiết kiệm với kỳ hạn, lãi suất và mức phạt khác nhau.
- Cho phép người dùng mở khoản gửi bằng token USDC giả lập để thử nghiệm.
- Trả lãi khi đến hạn, hoặc trừ phí nếu rút sớm.
- Cấp một NFT cho mỗi khoản gửi để chứng minh quyền sở hữu.
- Có cơ chế tạm dừng khẩn cấp nếu cần khóa hệ thống.

## Các phần chính

### MockUSDC.sol
Token test dùng để mô phỏng USDC thật. Token này chỉ dùng trong môi trường thử nghiệm.

### VaultManager.sol
Quản lý quỹ trả lãi và tiền phạt. Đây là nơi giữ phần tiền dùng để trả lãi cho người gửi.

### SavingCore.sol
Phần xử lý chính của hệ thống. Hợp đồng này nhận tiền gửi, tạo NFT, tính lãi, xử lý rút tiền và gia hạn.

## Cách người dùng sử dụng

1. Chọn một gói tiết kiệm.
2. Gửi token vào hợp đồng.
3. Nhận NFT đại diện cho khoản gửi.
4. Đợi đến hạn để rút cả gốc lẫn lãi.
5. Nếu cần, có thể rút sớm với phí phạt.
6. Có thể gia hạn thủ công hoặc để hệ thống tự gia hạn sau thời gian ân hạn.

## Cách chạy dự án

### Cài đặt

```bash
cd online-banking-system
npm install
```

### Biên dịch smart contract

```bash
npx hardhat compile
```

### Chạy kiểm thử

```bash
npx hardhat test
```

### Xem báo cáo độ phủ code

```bash
npx hardhat coverage
```

## Frontend

Phần giao diện nằm trong thư mục frontend/. Dự án React này có thể chạy bằng:

```bash
cd frontend
npm install
npm start
```

## Ý tưởng hoạt động

Người dùng không gửi tiền trực tiếp vào một ngân hàng truyền thống. Thay vào đó, tiền được đưa vào smart contract. Hệ thống ghi lại thông tin khoản gửi, ngày đáo hạn, lãi suất và trạng thái bằng dữ liệu trên blockchain. NFT dùng như một “giấy chứng nhận” cho khoản tiền đó.

## Những tính năng có sẵn

- Tạo gói tiết kiệm mới.
- Gửi tiền theo gói đã chọn.
- Rút tiền khi đến hạn.
- Rút sớm có phạt.
- Gia hạn khoản gửi.
- Tạm dừng hệ thống khi có sự cố.

## Cấu trúc thư mục chính

```text
online-banking-system/
├── contracts/        Smart contract
├── test/             Bộ kiểm thử
├── frontend/         Giao diện web React
├── hardhat.config.js Cấu hình Hardhat
└── README.md         Tài liệu này
```

## Ghi chú cho người mới

- Đây là dự án để học và thử nghiệm, không phải sản phẩm ngân hàng thật.
- Token đang dùng là token giả lập để test.
- Nếu muốn chạy trên mạng thật như Sepolia, cần thêm cấu hình ví và khóa riêng.

## Trạng thái hiện tại

- Smart contract: đã hoàn thành.
- Kiểm thử: đã có bộ test tự động.
- Frontend: đang là phần tiếp theo cần hoàn thiện.

