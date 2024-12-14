const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Cấu hình Cloudinary
    // Configuration
cloudinary.config({ 
    cloud_name: 'dbmrh7gyn', 
    api_key: '318359977138754', 
    api_secret: 'TIA0jtCJ2iXSZJWD4-OqW7Ke8xY'
});

// Cấu hình storage cho Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'product_images', // tên folder trên Cloudinary
        resource_type: 'auto', // tự động nhận diện loại file
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff'], // cho phép nhiều định dạng ảnh
        transformation: [{ width: 500, height: 500, crop: 'limit' }] // có thể thêm các options transform
    }
});

// Cấu hình multer với Cloudinary storage
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Kiểm tra xem file có phải là ảnh không
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('File phải là ảnh'), false);
        }
    },
    limits: {
        fileSize: 1024 * 1024 * 5 // giới hạn file 5MB
    }
});

const uploadImage = upload.array('product_images', 6);

module.exports = uploadImage;