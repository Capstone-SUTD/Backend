const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const approvalRoutes = require("./routes/approvalRoutes");

dotenv.config();

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/app", approvalRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));