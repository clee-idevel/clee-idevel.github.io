// ==================== 상수 및 설정 ====================
const STORAGE_KEYS = {
    LOGS: 'studyTimer_logs',
    THEME: 'studyTimer_theme',
    CONFIG: 'studyTimer_config'
};

// 기본 설정
const DEFAULT_CONFIG = {
    READY_SECONDS: 5,
    STUDY_SECONDS: 50 * 60,     // 50분
    REST_SECONDS: 10 * 60,      // 10분
    TOTAL_SETS: 10
};

// 페이즈 상태
const PHASE = {
    IDLE: 'idle',
    READY: 'ready',
    STUDY: 'study',
    REST: 'rest',
    COMPLETE: 'complete'
};

// ==================== 유틸리티 함수 ====================
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatCountdown(seconds) {
    return seconds.toString();
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
    if (mins > 0) {
        const secs = seconds % 60;
        return secs > 0 ? `${mins}분 ${secs}초` : `${mins}분`;
    }
    return `${seconds}초`;
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

// ==================== 설정 관리 ====================
const ConfigManager = {
    config: { ...DEFAULT_CONFIG },

    init() {
        const saved = Storage.get(STORAGE_KEYS.CONFIG, null);
        if (saved) {
            this.config = { ...DEFAULT_CONFIG, ...saved };
        }
        this.updateUI();
        this.bindEvents();
    },

    updateUI() {
        const studyMins = Math.floor(this.config.STUDY_SECONDS / 60);
        const studySecs = this.config.STUDY_SECONDS % 60;
        const restMins = Math.floor(this.config.REST_SECONDS / 60);
        const restSecs = this.config.REST_SECONDS % 60;

        document.getElementById('studyMinutes').value = studyMins;
        document.getElementById('studySeconds').value = studySecs;
        document.getElementById('restMinutes').value = restMins;
        document.getElementById('restSeconds').value = restSecs;
        document.getElementById('readySeconds').value = this.config.READY_SECONDS;
        document.getElementById('totalSets').value = this.config.TOTAL_SETS;
    },

    apply() {
        const studyMins = parseInt(document.getElementById('studyMinutes').value) || 0;
        const studySecs = parseInt(document.getElementById('studySeconds').value) || 0;
        const restMins = parseInt(document.getElementById('restMinutes').value) || 0;
        const restSecs = parseInt(document.getElementById('restSeconds').value) || 0;
        const readySecs = parseInt(document.getElementById('readySeconds').value) || 5;
        const totalSets = parseInt(document.getElementById('totalSets').value) || 10;

        this.config.STUDY_SECONDS = studyMins * 60 + studySecs;
        this.config.REST_SECONDS = restMins * 60 + restSecs;
        this.config.READY_SECONDS = Math.max(1, readySecs);
        this.config.TOTAL_SETS = Math.max(1, totalSets);

        Storage.set(STORAGE_KEYS.CONFIG, this.config);
        Timer.reset();
        Timer.regenerateSetDots();
        alert('설정이 적용되었습니다.');
    },

    bindEvents() {
        document.getElementById('applySettings').addEventListener('click', () => {
            if (Timer.isRunning || Timer.currentPhase !== PHASE.IDLE) {
                if (!confirm('타이머가 진행 중입니다. 설정을 적용하면 리셋됩니다. 계속하시겠습니까?')) {
                    return;
                }
            }
            this.apply();
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

    add(startTime, endTime, duration, setNumber) {
        const log = {
            id: generateId(),
            startTime,
            endTime,
            duration,
            setNumber,
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
                    <span class="log-preset">${log.setNumber}세트</span>
                </div>
                ${log.comment ? `<div class="log-comment">${log.comment}</div>` : ''}
                <div class="log-actions">
                    <button class="comment-btn" data-id="${log.id}">
                        ${log.comment ? '수정' : '코멘트'}
                    </button>
                    <button class="delete-log" data-id="${log.id}">
                        삭제
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
    currentPhase: PHASE.IDLE,
    currentSet: 1,
    totalSeconds: 5,
    remainingSeconds: 5,
    intervalId: null,
    isRunning: false,
    phaseStartTime: null,

    init() {
        this.reset();
        this.bindEvents();
        this.updateDisplay();
        this.updateSetGauge();
    },

    regenerateSetDots() {
        const container = document.getElementById('setDots');
        container.innerHTML = '';
        for (let i = 1; i <= ConfigManager.config.TOTAL_SETS; i++) {
            const dot = document.createElement('div');
            dot.className = 'set-dot';
            dot.dataset.set = i;
            container.appendChild(dot);
        }
        this.updateSetGauge();
    },

    reset() {
        this.stop();
        this.currentPhase = PHASE.IDLE;
        this.currentSet = 1;
        this.totalSeconds = ConfigManager.config.READY_SECONDS;
        this.remainingSeconds = ConfigManager.config.READY_SECONDS;
        this.phaseStartTime = null;
        this.updateDisplay();
        this.updatePhaseUI();
        this.updateSetGauge();

        document.getElementById('startBtn').disabled = false;
        document.getElementById('pauseBtn').disabled = true;
    },

    start() {
        if (this.isRunning) return;

        // IDLE 상태에서 시작하면 READY 페이즈로 전환
        if (this.currentPhase === PHASE.IDLE) {
            this.currentPhase = PHASE.READY;
            this.totalSeconds = ConfigManager.config.READY_SECONDS;
            this.remainingSeconds = ConfigManager.config.READY_SECONDS;
        }

        this.isRunning = true;
        this.phaseStartTime = new Date().toISOString();

        document.getElementById('startBtn').disabled = true;
        document.getElementById('pauseBtn').disabled = false;
        document.querySelector('.timer-section').classList.add('running');

        this.updatePhaseUI();
        this.updateSetGauge();

        this.intervalId = setInterval(() => {
            this.remainingSeconds--;
            this.updateDisplay();

            if (this.remainingSeconds <= 0) {
                this.completePhase();
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
        clearInterval(this.intervalId);
    },

    completePhase() {
        this.pause();
        const endTime = new Date().toISOString();

        // 완료 애니메이션
        const timerSection = document.querySelector('.timer-section');
        timerSection.classList.add('completed');
        setTimeout(() => timerSection.classList.remove('completed'), 600);

        // 알림음 재생
        this.playAlarm();

        // 페이즈에 따른 처리
        switch (this.currentPhase) {
            case PHASE.READY:
                // 준비 완료 → 공부 시작
                this.currentPhase = PHASE.STUDY;
                this.totalSeconds = ConfigManager.config.STUDY_SECONDS;
                this.remainingSeconds = ConfigManager.config.STUDY_SECONDS;
                this.updatePhaseUI();
                this.updateDisplay();
                // 자동으로 다음 페이즈 시작
                setTimeout(() => this.start(), 500);
                break;

            case PHASE.STUDY:
                // 공부 완료 → 로그 저장 → 휴식 시작
                LogManager.add(this.phaseStartTime, endTime, ConfigManager.config.STUDY_SECONDS, this.currentSet);
                this.currentPhase = PHASE.REST;
                this.totalSeconds = ConfigManager.config.REST_SECONDS;
                this.remainingSeconds = ConfigManager.config.REST_SECONDS;
                this.updatePhaseUI();
                this.updateDisplay();
                this.showNotification('공부 완료!', `${this.currentSet}세트 공부 완료! 휴식 시간입니다.`);
                // 자동으로 휴식 시작
                setTimeout(() => this.start(), 500);
                break;

            case PHASE.REST:
                // 휴식 완료 → 다음 세트 또는 완료 (휴식은 로그에 안남김)
                this.updateSetGauge();

                if (this.currentSet >= ConfigManager.config.TOTAL_SETS) {
                    // 모든 세트 완료
                    this.currentPhase = PHASE.COMPLETE;
                    this.updatePhaseUI();
                    this.showNotification('모든 세트 완료!', `${ConfigManager.config.TOTAL_SETS}세트를 모두 완료했습니다! 수고하셨습니다!`);
                    alert('모든 세트를 완료했습니다! 수고하셨습니다!');
                    this.reset();
                } else {
                    // 다음 세트 준비
                    this.currentSet++;
                    this.currentPhase = PHASE.READY;
                    this.totalSeconds = ConfigManager.config.READY_SECONDS;
                    this.remainingSeconds = ConfigManager.config.READY_SECONDS;
                    this.updatePhaseUI();
                    this.updateDisplay();
                    this.showNotification('휴식 완료!', `${this.currentSet}세트를 시작합니다.`);
                    // 자동으로 다음 세트 준비 시작
                    setTimeout(() => this.start(), 500);
                }
                break;
        }
    },

    playAlarm() {
        const audio = document.getElementById('alarmSound');
        audio.currentTime = 0;
        audio.play().catch(() => {
            // 자동 재생이 차단된 경우 무시
        });
    },

    showNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '📚' });
        }
    },

    updateDisplay() {
        const timeDisplay = document.getElementById('timeDisplay');

        // 준비 단계에서는 숫자만 표시
        if (this.currentPhase === PHASE.READY || (this.currentPhase === PHASE.IDLE)) {
            timeDisplay.textContent = formatCountdown(this.remainingSeconds);
            timeDisplay.classList.add('countdown-mode');
        } else {
            timeDisplay.textContent = formatTime(this.remainingSeconds);
            timeDisplay.classList.remove('countdown-mode');
        }

        // Progress ring 업데이트
        const progress = this.remainingSeconds / this.totalSeconds;
        const circumference = 2 * Math.PI * 130; // r=130
        const offset = circumference * (1 - progress);

        const circle = document.querySelector('.progress-ring-circle');
        circle.style.strokeDasharray = circumference;
        circle.style.strokeDashoffset = offset;
    },

    updatePhaseUI() {
        const phaseLabel = document.getElementById('phaseLabel');
        const presetLabel = document.getElementById('presetLabel');
        const setLabel = document.getElementById('setLabel');
        const circle = document.querySelector('.progress-ring-circle');

        setLabel.textContent = `${this.currentSet} / ${ConfigManager.config.TOTAL_SETS} 세트`;

        switch (this.currentPhase) {
            case PHASE.IDLE:
                phaseLabel.textContent = '대기';
                phaseLabel.className = 'phase-label phase-idle';
                presetLabel.textContent = '시작을 눌러주세요';
                circle.style.stroke = 'var(--accent-color)';
                break;
            case PHASE.READY:
                phaseLabel.textContent = '준비';
                phaseLabel.className = 'phase-label phase-ready';
                presetLabel.textContent = '곧 시작합니다...';
                circle.style.stroke = 'var(--warning-color)';
                break;
            case PHASE.STUDY:
                phaseLabel.textContent = '공부';
                phaseLabel.className = 'phase-label phase-study';
                presetLabel.textContent = '집중하세요!';
                circle.style.stroke = 'var(--success-color)';
                break;
            case PHASE.REST:
                phaseLabel.textContent = '휴식';
                phaseLabel.className = 'phase-label phase-rest';
                presetLabel.textContent = '잠시 쉬어가세요';
                circle.style.stroke = 'var(--accent-color)';
                break;
            case PHASE.COMPLETE:
                phaseLabel.textContent = '완료';
                phaseLabel.className = 'phase-label phase-complete';
                presetLabel.textContent = '수고하셨습니다!';
                circle.style.stroke = 'var(--success-color)';
                break;
        }
    },

    updateSetGauge() {
        const dots = document.querySelectorAll('.set-dot');
        dots.forEach((dot, index) => {
            const setNum = index + 1;
            dot.classList.remove('completed', 'active');

            if (setNum < this.currentSet) {
                dot.classList.add('completed');
            } else if (setNum === this.currentSet && this.currentPhase !== PHASE.IDLE) {
                dot.classList.add('active');
            }
        });
    },

    bindEvents() {
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.pause());
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (this.isRunning || this.currentPhase !== PHASE.IDLE) {
                if (confirm('타이머를 리셋하시겠습니까? 현재 진행 상황이 초기화됩니다.')) {
                    this.reset();
                }
            }
        });
    }
};

// ==================== 모달 관리 ====================
const ModalManager = {
    init() {
        this.bindCommentModal();
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

    ConfigManager.init();
    LogManager.init();
    Timer.init();
    Timer.regenerateSetDots();
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
