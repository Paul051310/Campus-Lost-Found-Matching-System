   const mongoose = require("mongoose");

   const uploadedImageSchema = new mongoose.Schema(
     {
       filename: {
         type: String,
         required: true,
         unique: true,
       },
       contentType: {
         type: String,
         required: true,
       },
       data: {
         type: Buffer,
         required: true,
       },
     },
     { timestamps: true }
   );

   module.exports = mongoose.model("UploadedImage", uploadedImageSchema);