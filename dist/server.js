"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const morgan_1 = __importDefault(require("morgan"));
const client_1 = require("@prisma/client");
const auth_1 = __importDefault(require("./routes/auth"));
const user_1 = __importDefault(require("./routes/user"));
const resturant_1 = __importDefault(require("./routes/resturant"));
const order_1 = __importDefault(require("./routes/order"));
const deliveryPersonnel_1 = __importDefault(require("./routes/deliveryPersonnel"));
const helmet_1 = __importDefault(require("helmet"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
app.use((0, cors_1.default)());
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use("/api/auth", auth_1.default);
app.use("/api/users", user_1.default);
app.use("/api/restaurants", resturant_1.default);
app.use("/api/orders", order_1.default);
app.use("/api/delivery", deliveryPersonnel_1.default);
app.get("/", (req, res) => {
    res.send("Delivery API is running");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
process.on("SIGTERM", () => __awaiter(void 0, void 0, void 0, function* () {
    console.log("SIGTERM signal receiver: closing HTTP server");
    yield prisma.$disconnect();
    process.exit();
}));
exports.default = app;
