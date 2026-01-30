// ==================== 상수 및 기본값 ====================
const STORAGE_KEYS = {
    PRESETS: 'studyTimer_presets',
    LOGS: 'studyTimer_logs',
    THEME: 'studyTimer_theme'
};

const DEFAULT_PRESETS = [
    { id: 'default_1', name: '뽀모도로', minutes: 25, isDefault: true },
    { id: 'default_2', name: '집중', minutes: 50, isDefault: true },
    { id: 'default_3', name: '딥워크', minutes: 90, isDefault: true }
];

// ==================== 유틸리티 함수 ====================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatDateTime(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    if (mins >= 60) {
        const hours = Math.floor(mins / 60);
        const remainMins = mins % 60;
        return `${hours}시간 ${remainMins}분`;
    }
    return `${mins}분`;
}

// ==================== 스토리지 관리 ====================
const Storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage set error:', e);
        }
    }
};

// ==================== 프리셋 관리 ====================
const PresetManager = {
    presets: [],

    init() {
        this.presets = Storage.get(STORAGE_KEYS.PRESETS, DEFAULT_PRESETS);
        this.render();
    },

    getAll() {
        return this.presets;
    },

    add(name, minutes) {
        const preset = {
            id: generateId(),
            name: name.trim(),
            minutes: parseInt(minutes),
            isDefault: false
        };
        this.presets.push(preset);
        this.save();
        this.render();
        return preset;
    },

    remove(id) {
        const preset = this.presets.find(p => p.id === id);
        if (preset && preset.isDefault) return false;

        this.presets = this.presets.filter(p => p.id !== id);
        this.save();
        this.render();
        return true;
    },

    save() {
        Storage.set(STORAGE_KEYS.PRESETS, this.presets);
    },

    render() {
        const container = document.getElementById('presetList');
        container.innerHTML = '';

        this.presets.forEach(preset => {
            const btn = document.createElement('button');
            btn.className = `preset-btn ${preset.isDefault ? 'default' : ''} ${Timer.currentPreset?.id === preset.id ? 'active' : ''}`;
            btn.innerHTML = `
                <span>${preset.name} (${preset.minutes}분)</span>
                <span class="delete-preset" data-id="${preset.id}" title="삭제">×</span>
            `;

            btn.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-preset')) {
                    e.stopPropagation();
                    if (confirm(`"${preset.name}" 프리셋을 삭제하시겠습니까?`)) {
                        this.remove(preset.id);
                    }
                } else {
                    Timer.setPreset(preset);
                }
            });

            container.appendChild(btn);
        });
    }
};

// ==================== 로그 관리 ====================
const LogManager = {
    logs: [],

    init() {
        this.logs = Storage.get(STORAGE_KEYS.LOGS, []);
        this.render();
    },

    add(startTime, endTime, duration, presetName) {
        const log = {
            id: generateId(),
            startTime,
            endTime,
            duration,
            presetName,
            comment: ''
        };
        this.logs.unshift(log);
        this.save();
        this.render();
        return log;
    },

    updateComment(id, comment) {
        const log = this.logs.find(l => l.id === id);
        if (log) {
            log.comment = comment;
            this.save();
            this.render();
        }
    },

    remove(id) {
        this.logs = this.logs.filter(l => l.id !== id);
        this.save();
        this.render();
    },

    save() {
        Storage.set(STORAGE_KEYS.LOGS, this.logs);
    },

    render() {
        const container = document.getElementById('logList');
        const emptyMessage = document.getElementById('emptyLog');

        if (this.logs.length === 0) {
            container.innerHTML = '';
            emptyMessage.style.display = 'block';
            return;
        }

        emptyMessage.style.display = 'none';
        container.innerHTML = '';

        this.logs.forEach(log => {
            const item = document.createElement('div');
            item.className = 'log-item';
            item.innerHTML = `
                <div class="log-header">
                    <div class="log-info">
                        <div class="log-date">${formatDateTime(log.startTime)}</div>
                        <div class="log-time">
                            <span class="log-duration">${formatDuration(log.duration)}</span> 완료
                        </div>
                    </div>
                    <span class="log-preset">${log.presetName}</span>
                </div>
                ${log.comment ? `<div class="log-comment">${log.comment}</div>` : ''}
                <div class="log-actions">
                    <button class="comment-btn" data-id="${log.id}">
                        ${log.comment ? '✏️ 수정' : '💬 코멘트'}
                    </button>
                    <button class="delete-log" data-id="${log.id}">
                        🗑️ 삭제
                    </button>
                </div>
            `;

            const commentBtn = item.querySelector('.comment-btn');
            const deleteBtn = item.querySelector('.delete-log');

            commentBtn.addEventListener('click', () => {
                ModalManager.openComment(log.id, log.comment);
            });

            deleteBtn.addEventListener('click', () => {
                if (confirm('이 로그를 삭제하시겠습니까?')) {
                    this.remove(log.id);
                }
            });

            container.appendChild(item);
        });
    }
};

// ==================== 타이머 ====================
const Timer = {
    totalSeconds: 25 * 60,
    remainingSeconds: 25 * 60,
    intervalId: null,
    isRunning: false,
    startTime: null,
    currentPreset: null,

    init() {
        this.setPreset(PresetManager.getAll()[0]);
        this.updateDisplay();
        this.bindEvents();
    },

    setPreset(preset) {
        if (this.isRunning) {
            if (!confirm('타이머가 실행 중입니다. 프리셋을 변경하시겠습니까?')) {
                return;
            }
            this.stop();
        }

        this.currentPreset = preset;
        this.totalSeconds = preset.minutes * 60;
        this.remainingSeconds = this.totalSeconds;
        this.updateDisplay();
        PresetManager.render();

        document.getElementById('presetLabel').textContent = preset.name;
    },

    start() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.startTime = new Date().toISOString();

        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.querySelector('.timer-section').classList.add('running');

        this.intervalId = setInterval(() => {
            this.remainingSeconds--;
            this.updateDisplay();

            if (this.remainingSeconds <= 0) {
                this.complete();
            }
        }, 1000);
    },

    pause() {
        if (!this.isRunning) return;

        this.isRunning = false;
        clearInterval(this.intervalId);

        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
        document.querySelector('.timer-section').classList.remove('running');
    },

    stop() {
        this.pause();
        this.remainingSeconds = this.totalSeconds;
        this.startTime = null;
        this.updateDisplay();
    },

    complete() {
        this.pause();

        const endTime = new Date().toISOString();
        const duration = this.totalSeconds;

        // 로그 저장
        LogManager.add(this.startTime, endTime, duration, this.currentPreset.name);

        // 완료 애니메이션
        const timerSection = document.querySelector('.timer-section');
        timerSection.classList.add('completed');
        setTimeout(() => timerSection.classList.remove('completed'), 600);

        // 알림음 재생
        this.playAlarm();

        // 알림
        this.showNotification();

        // 리셋
        this.remainingSeconds = this.totalSeconds;
        this.startTime = null;
        this.updateDisplay();
    },

    playAlarm() {
        const audio = document.getElementById('alarmSound');
        audio.currentTime = 0;
        audio.play().catch(() => {
            // 자동 재생이 차단된 경우 무시
        });
    },

    showNotification() {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('공부 완료!', {
                body: `${this.currentPreset.name} (${this.currentPreset.minutes}분) 완료!`,
                icon: '📚'
            });
        }

        alert(`${this.currentPreset.name} 완료! 수고하셨습니다. 🎉`);
    },

    updateDisplay() {
        document.getElementById('timeDisplay').textContent = formatTime(this.remainingSeconds);

        // Progress ring 업데이트
        const progress = this.remainingSeconds / this.totalSeconds;
        const circumference = 2 * Math.PI * 130; // r=130
        const offset = circumference * (1 - progress);

        const circle = document.querySelector('.progress-ring-circle');
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = offset;
    },

    bindEvents() {
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (this.isRunning || this.remainingSeconds < this.totalSeconds) {
                if (confirm('타이머를 리셋하시겠습니까?')) {
                    this.stop();
                }
            }
        });
    }
};

// ==================== 모달 관리 ====================
const ModalManager = {
    init() {
        this.bindPresetModal();
        this.bindCommentModal();
    },

    bindPresetModal() {
        const modal = document.getElementById('presetModal');
        const addBtn = document.getElementById('addPresetBtn');
        const cancelBtn = document.getElementById('cancelPreset');
        const saveBtn = document.getElementById('savePreset');
        const nameInput = document.getElementById('presetName');
        const minutesInput = document.getElementById('presetMinutes');

        addBtn.addEventListener('click', () => {
            nameInput.value = '';
            minutesInput.value = '';
            modal.classList.add('show');
            nameInput.focus();
        });

        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });

        saveBtn.addEventListener('click', () => {
            const name = nameInput.value.trim();
            const minutes = parseInt(minutesInput.value);

            if (!name) {
                alert('이름을 입력해주세요.');
                nameInput.focus();
                return;
            }

            if (!minutes || minutes < 1 || minutes > 180) {
                alert('1~180 사이의 시간을 입력해주세요.');
                minutesInput.focus();
                return;
            }

            PresetManager.add(name, minutes);
            modal.classList.remove('show');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    },

    bindCommentModal() {
        const modal = document.getElementById('commentModal');
        const cancelBtn = document.getElementById('cancelComment');
        const saveBtn = document.getElementById('saveComment');
        const textInput = document.getElementById('commentText');
        const logIdInput = document.getElementById('commentLogId');

        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });

        saveBtn.addEventListener('click', () => {
            const logId = logIdInput.value;
            const comment = textInput.value.trim();

            LogManager.updateComment(logId, comment);
            modal.classList.remove('show');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    },

    openComment(logId, currentComment) {
        const modal = document.getElementById('commentModal');
        const textInput = document.getElementById('commentText');
        const logIdInput = document.getElementById('commentLogId');

        logIdInput.value = logId;
        textInput.value = currentComment || '';
        modal.classList.add('show');
        textInput.focus();
    }
};

// ==================== 테마 관리 ====================
const ThemeManager = {
    init() {
        const savedTheme = Storage.get(STORAGE_KEYS.THEME, 'light');
        this.setTheme(savedTheme);

        document.getElementById('themeToggle').addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            this.setTheme(newTheme);
        });
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        Storage.set(STORAGE_KEYS.THEME, theme);

        const themeBtn = document.getElementById('themeToggle');
        themeBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
};

// ==================== 앱 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
    // 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    PresetManager.init();
    LogManager.init();
    Timer.init();
    ModalManager.init();
    ThemeManager.init();
});

// 페이지 이탈 시 경고
window.addEventListener('beforeunload', (e) => {
    if (Timer.isRunning) {
        e.preventDefault();
        e.returnValue = '타이머가 실행 중입니다. 페이지를 떠나시겠습니까?';
    }
});
