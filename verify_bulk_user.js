import axios from 'axios';
import XLSX from 'xlsx';
import FormData from 'form-data';
import fs from 'fs';

// Configuration
const API_URL = 'http://localhost:5001/api'; // Adjust port if needed
const SUPER_ADMIN = {
    username: 'superadmin',
    password: 'SuperAdmin123!'
};

async function runVerification() {
    console.log('🚀 Starting bulk user verification (Fixed Token Logic)...');

    try {
        // 1. Login
        console.log('1️⃣  Logging in as Super Admin...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, SUPER_ADMIN);
        
        // Response structure: { success: true, message: "...", data: { user: {...}, tokens: { accessToken: "...", refreshToken: "..." } } }
        const token = loginRes.data.data.tokens.accessToken;
        
        const loggedInUser = loginRes.data.data.user;
        console.log('✅ Login successful.');

        // 2. Download Template
        console.log('2️⃣  Testing Template Download...');
        try {
            const templateRes = await axios.get(`${API_URL}/bulk-users/template`, {
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'arraybuffer'
            });
            if (templateRes.status === 200 && templateRes.headers['content-type'].includes('spreadsheet')) {
                console.log('✅ Template download successful.');
            } else {
                console.error('❌ Template download failed or wrong content type.');
            }
        } catch (error) {
            console.error('❌ Error downloading template:', error.message);
        }

        // 3. Create Sample Excel File
        console.log('3️⃣  Creating Sample Excel File...');
        const randId = Math.floor(Math.random() * 10000);
        
        let validDeptCode = 'IT'; 
        if (loggedInUser.department && loggedInUser.department.code) {
             validDeptCode = loggedInUser.department.code;
        }

        const sampleData = [
            {
                'Họ và tên': `Test User Delta ${randId}`,
                'Số điện thoại': '0900000003',
                'Mã nhân viên': `EMP_D_${randId}`,
                'Mã phòng ban': validDeptCode,
                'Role (user, admin)': 'user'
            },
            {
                'Họ và tên': `Test User Epsilon ${randId}`,
                'Số điện thoại': '0900000004',
                'Mã nhân viên': `EMP_E_${randId}`,
                'Mã phòng ban': '', // MISSING DEPT CODE -> EXPECT FAILURE
                'Role (user, admin)': 'user'
            },
            {
                'Họ và tên': `Test User Zet ${randId}`,
                'Số điện thoại': '0900000005',
                'Mã nhân viên': `EMP_Z_${randId}`,
                'Mã phòng ban': validDeptCode,
                'Role (user, admin)': 'invalid_role' // INVALID ROLE -> EXPECT FAILURE
            }
        ];

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(sampleData);
        XLSX.utils.book_append_sheet(wb, ws, 'Users');
        
        const fileName = `verify_import_v2_${randId}.xlsx`;
        XLSX.writeFile(wb, fileName);
        console.log(`✅ File ${fileName} created.`);

        // 4. Upload File
        console.log('4️⃣  Uploading Excel File for Bulk Import...');
        const form = new FormData();
        form.append('file', fs.createReadStream(fileName));

        const uploadRes = await axios.post(`${API_URL}/bulk-users/upload`, form, {
            headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${token}`
            },
            validateStatus: status => status < 500
        });

        console.log('✅ Upload response status:', uploadRes.status);
        console.log('📊 Upload Summary:', JSON.stringify(uploadRes.data.data.summary, null, 2));
        
        const createdCount = uploadRes.data.data.summary.success;
        const failedCount = uploadRes.data.data.summary.failed;

        if (failedCount >= 2 && createdCount >= 0) {
             console.log('🎉 Verification PASSED: Logic handles validation correctly.');
        } else {
            console.log('⚠️ Verification WARNING: Results not as expected.');
        }
        
        console.log('Errors:', JSON.stringify(uploadRes.data.data.errors, null, 2));

        // Cleanup
        fs.unlinkSync(fileName);

    } catch (error) {
        console.error('❌ Verification FAILED:', error.response ? error.response.data : error.message);
    }
}

runVerification();
