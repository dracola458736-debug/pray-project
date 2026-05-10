// 1. إدارة الشاشات والعناصر
const btnStart = document.getElementById('btn-start-app');
const screenSelect = document.getElementById('screen-select');
const screenTracker = document.getElementById('screen-tracker');
const screenFinish = document.getElementById('screen-finish');
const btnHome = document.getElementById('btn-home');

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
            console.log('Screen Wake Lock is active');
        }
    } catch (err) {
        console.error(`${err.name}, ${err.message}`);
    }
}

// 4. وظيفة النطق الصوتي
function speak(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    window.speechSynthesis.speak(utterance);
}

// 5. منطق "المستشعر" باستخدام الكاميرا (رصد الإعتام عند السجود)
function processFrame() {
    if (!screenTracker.classList.contains('active')) return;

    canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    const frame = canvasCtx.getImageData(0, 0, canvasElement.width, canvasElement.height);
    const data = frame.data;
    
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 4) {
        // حساب السطوع لكل بكسل (متوسط RGB)
        totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }
    
    const avgBrightness = totalBrightness / (data.length / 4);
    
    // إذا كان السطوع منخفضاً جداً (الجسم غطى الكاميرا)
    const threshold = 40; // عتبة الظلام (يمكن تعديلها حسب الإضاءة)
    
    if (avgBrightness < threshold && !isSajdaActive) {
        isSajdaActive = true;
        handleSajdaDetection();
    } else if (avgBrightness > threshold + 20) {
        isSajdaActive = false;
    }

    requestAnimationFrame(processFrame);
}

function handleSajdaDetection() {
    sajdaInCurrentRaka++;
    playNotificationSound(); // صوت تنبيه خفيف عند كل سجدة
    
    if (sajdaInCurrentRaka === 2) {
        rakatCount++;
        sajdaInCurrentRaka = 0;
        rakatDisplay.innerText = rakatCount;
        
        // نطق رقم الركعة
        speak(rakatCount.toString());
        
        if (rakatCount >= targetRakat) {
            // انتظار التسليم يدوياً أو تلقائياً
            setTimeout(() => {
                finishPrayer();
            }, 2000);
        }
    }
}

function finishPrayer() {
    screenTracker.classList.remove('active');
    screenFinish.classList.add('active');
    document.getElementById('prayer-athkar').innerText = athkarText;
    if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
}

if (btnHome) {
    btnHome.onclick = () => window.location.href = 'index.html';
}

// اختيار الصلاة وبدء العمل
document.querySelectorAll('.prayer-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        selectedPrayerName = btn.querySelector('span').innerText;
        targetRakat = prayerData[selectedPrayerName] || 4;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: "user" } 
            });
            videoElement.srcObject = stream;
            videoElement.play();
            
            currentPrayerNameDisplay.innerText = `صلاة ${selectedPrayerName}`;
            totalRakatTargetDisplay.innerText = targetRakat;
            rakatCount = 0;
            sajdaInCurrentRaka = 0;
            rakatDisplay.innerText = "0";

            screenSelect.classList.remove('active');
            screenTracker.classList.add('active');
            
            requestWakeLock(); // منع إغلاق الشاشة
            requestAnimationFrame(processFrame); // بدء رصد "المستشعر"
            
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
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.1);
}