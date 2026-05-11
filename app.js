// 1. إدارة الشاشات والعناصر
const btnStart = document.getElementById('btn-start-app');
const screenSelect = document.getElementById('screen-select');
const screenTracker = document.getElementById('screen-tracker');
const screenFinish = document.getElementById('screen-finish');
const btnHome = document.getElementById('btn-home');
const btnFinishPrayer = document.getElementById('btn-finish-prayer');
const btnCloseTracker = document.getElementById('btn-close-tracker');
const cameraModal = document.getElementById('camera-modal');
const btnModalAllow = document.getElementById('btn-modal-allow');
const btnModalClose = document.getElementById('btn-modal-close');
const modalMessage = document.getElementById('modal-message');
const modalTitle = document.getElementById('modal-title');
const modalIconBox = document.getElementById('modal-icon-box');

let selectedPrayerName = "";
let targetRakat = 0;
const prayerData = {
    "الفجر": 2,
    "الظهر": 4,
    "العصر": 4,
    "المغرب": 3,
    "العشاء": 4
};

const athkarText = "استغفر الله (3 مرات)، اللهم أنت السلام ومنك السلام تباركت يا ذا الجلال والإكرام. لا إله إلا الله وحده لا شريك له، له الملك وله الحمد وهو على كل شيء قدير.";

// 2. متغيرات العداد والمستشعر
let rakatCount = 0;
let sajdaInCurrentRaka = 0;
let isSajdaActive = false;
let wakeLock = null;
let stream = null; // تخزين الـ stream لإغلاقه

const videoElement = document.getElementById('cam-video');
const canvasElement = document.getElementById('cam-canvas');
const canvasCtx = canvasElement.getContext('2d');
const rakatDisplay = document.getElementById('rakat-display');
const totalRakatTargetDisplay = document.getElementById('total-rakat-target');
const currentPrayerNameDisplay = document.getElementById('current-prayer-name');

// 3. وظيفة منع إغلاق الشاشة
async function requestWakeLock() {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

// 4. وظيفة النطق الصوتي (نطق الأرقام فقط)
function speak(text) {
    const arabicNumbers = {
        "1": "واحد",
        "2": "اثنان",
        "3": "ثلاثة",
        "4": "أربعة"
    };
    
    const msg = arabicNumbers[text] || text;
    const utterance = new SpeechSynthesisUtterance(msg);
    utterance.lang = 'ar-SA';
    utterance.rate = 1.0;
    utterance.pitch = 1;
    
    // إلغاء أي نطق جاري والبدء فوراً
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

// 5. منطق "المستشعر" باستخدام الكاميرا
function processFrame() {
    if (!screenTracker.classList.contains('active')) return;

    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    const frame = canvasCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    const data = frame.data;
    
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    const avgBrightness = totalBrightness / (data.length / 4);
    const threshold = 40; 
    
    if (avgBrightness < threshold && !isSajdaActive) {
        isSajdaActive = true;
        playNotificationSound(); 
    } 
    else if (avgBrightness > threshold + 20 && isSajdaActive) {
        isSajdaActive = false;
        handleRiseDetection();
    }

    requestAnimationFrame(processFrame);
}

function handleRiseDetection() {
    sajdaInCurrentRaka++;
    
    if (sajdaInCurrentRaka === 2) {
        rakatCount++;
        sajdaInCurrentRaka = 0;
        rakatDisplay.innerText = rakatCount;
        
        // نطق رقم الركعة المكتملة
        speak(rakatCount.toString());
        
        if (rakatCount >= targetRakat) {
            btnFinishPrayer.style.display = 'block';
            // تم إزالة رسالة النطق في النهاية بناء على الطلب
        }
    }
}

function finishPrayer() {
    stopCamera();
    screenTracker.classList.remove('active');
    screenFinish.classList.add('active');
    document.getElementById('prayer-athkar').innerText = athkarText;
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

// دالة لإظهار المودال (للرسائل والتأكيدات)
function showModal(title, message, iconClass, onConfirm = null) {
    modalTitle.innerText = title;
    modalMessage.innerText = message;
    modalIconBox.innerHTML = `<i class="fas ${iconClass}"></i>`;
    cameraModal.classList.add('active');
    
    if (onConfirm) {
        btnModalAllow.style.display = 'block';
        btnModalAllow.innerText = 'نعم';
        btnModalClose.innerText = 'إلغاء';
        btnModalAllow.onclick = () => {
            onConfirm();
            hideModal();
        };
    } else {
        btnModalAllow.style.display = 'none';
        btnModalClose.innerText = 'فهمت';
    }
}

function hideModal() {
    cameraModal.classList.remove('active');
}

// زر الخروج X في صفحة العداد
btnCloseTracker.onclick = () => {
    showModal('إنهاء الصلاة', 'هل ترغب في إنهاء الصلاة والعودة للقائمة؟', 'fa-question-circle', () => {
        stopCamera();
        screenTracker.classList.remove('active');
        screenSelect.classList.add('active');
    });
};

btnModalClose.onclick = hideModal;

btnFinishPrayer.onclick = finishPrayer;

if (btnHome) {
    btnHome.onclick = () => {
        screenFinish.classList.remove('active');
        screenSelect.classList.add('active');
    };
}

// اختيار الصلاة وبدء العمل
document.querySelectorAll('.prayer-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        selectedPrayerName = btn.querySelector('span').innerText;
        targetRakat = prayerData[selectedPrayerName] || 4;
        
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "user" } 
            });
            videoElement.srcObject = stream;
            videoElement.play();
            
            currentPrayerNameDisplay.innerText = `صلاة ${selectedPrayerName}`;
            totalRakatTargetDisplay.innerText = targetRakat;
            rakatCount = 0; // البدء من 0 ركعات مكتملة
            sajdaInCurrentRaka = 0;
            rakatDisplay.innerText = "0";
            btnFinishPrayer.style.display = 'none';

            screenSelect.classList.remove('active');
            screenTracker.classList.add('active');
            
            requestWakeLock();
            requestAnimationFrame(processFrame);
            
        } catch (err) {
            alert('يجب السماح بالكاميرا ليعمل المستشعر.');
        }
    });
});

function playNotificationSound() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.setValueAtTime(330, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}