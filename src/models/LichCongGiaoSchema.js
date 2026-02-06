const mongoose = require("mongoose");

const LichCongGiaoSchema = new mongoose.Schema(
    {
        title: String,
        date: String,
        mau_ao_le: String,
        alleluia: String,
        bac_le: String,
        bd_1: String,
        bd_2: String,
        cau_loi_chua: String,
        dap_ca: String,
        luu_y: String,
        mua_phung_vu: String,
        tin_mung: String,
        under_title: String,
        url: String,
        xu_chau_luot: String,
    },
    {
        collection: "lich-cong-giao", // 👈 QUAN TRỌNG
        timestamps: false,
    }
);

module.exports = mongoose.model("LichCongGiao", LichCongGiaoSchema);