// 游戏核心类和变量
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 游戏状态
let gameState = 'start'; // start, playing, paused, gameOver, upgrading
let score = 0;
let level = 1;
let gameSpeed = 1;

/**
 * 升级系统
 * - nextLevelScore: 第一次升级需要50分（降低难度）
 * - levelMultiplier: 每次升级所需分数增加50%（降低难度）
 * - maxUpgrades: 最大升级次数
 */
let upgradePoints = 0;
let nextLevelScore = 50; // 第一次升级需要30分（降低难度）
let levelMultiplier = 1.5; // 每次升级所需分数增加30%（降低难度）
let maxUpgrades = 20; // 最大升级次数

// 玩家属性升级系统 - 重新分类管理
let playerUpgrades = {
    // 等级管理系统（有最大等级限制）
    levelBased: {
        damage: 0,      // 火力强化 (最大5级，每级+12%)
        fireRate: 0,    // 射速强化 (最大5级，每级+5%)
        speed: 0,       // 机动强化 (最大5级，每级+5%)
        vampire: 0,     // 吸血 (最大3级)
        shield: 0,      // 护盾 (最大3级)
        ghost: 0        // 幽灵 (最大1级)
    },

    // 数量管理系统（无等级限制，按数量累积）
    countBased: {
        bomb: 0,        // 清屏炸弹数量
        revive: 0       // 复活道具数量
    }
};

// 升级配置 - 数值调整位置
const UPGRADE_CONFIG = {
    // 属性加成配置
    damage: { 
        maxLevel: 5, 
        increment: 0.12,    // 每级+12%
        name: '火力强化',
        description: '武器伤害+12%'
    },
    fireRate: { 
        maxLevel: 5, 
        increment: 0.05,    // 每级+5%
        name: '射速强化', 
        description: '武器射速+5%'
    },
    speed: { 
        maxLevel: 5, 
        increment: 0.05,    // 每级+5%
        name: '机动强化', 
        description: '移动速度+5%'
    },

    // 道具系统配置
    vampire: {
        maxLevel: 3,                // 最大3级
        baseProbability: 0.15,      // 基础触发概率15%
        baseHeal: 8,                // 基础回血量8点
        probabilityPerLevel: 0.08,  // 每级增加8%概率
        healPerLevel: 4,            // 每级增加4点回血
        name: '吸血',
        description: '攻击时概率回血'
    },
    shield: {
        maxLevel: 3,                // 最大3级
        baseShield: 40,             // 基础护盾值40点
        baseCooldown: 4000,         // 基础恢复时间4秒
        shieldPerLevel: 20,         // 每级增加20点护盾
        cooldownReduction: 600,     // 每级减少0.6秒恢复时间
        name: '护盾',
        description: '未受伤时生成护盾'
    },
    bomb: {
        countPerPickup: 3,          // 每次获得3个
        name: '清屏炸弹',
        description: '清除所有敌人子弹'
    },
    revive: {
        countPerPickup: 1,          // 每次获得1个
        name: '复活',
        description: '死亡时自动复活'
    },
    ghost: {
        maxLevel: 1,                // 只能获得一次
        invulnerabilityTime: 180,   // 3秒无敌时间（180帧）
        name: '幽灵',
        description: '受伤时获得短暂无敌'
    }
};

// 升级选项池权重配置
const UPGRADE_POOL_WEIGHTS = {
    damage: 25,
    fireRate: 25, 
    speed: 25,
    vampire: 25,
    shield: 25,
    bomb: 35,       // 炸弹概率稍高
    revive: 10,     // 复活概率较低
    ghost: 10       // 幽灵概率较低（和复活一样稀有）
};

// 玩家状态扩展
let playerState = {
    lastDamageTime: 0,      // 上次受伤时间
    shieldActive: false,    // 护盾是否激活
    shieldValue: 0,         // 当前护盾值
    isReviving: false       // 是否正在复活
};

// 游戏对象数组
let bullets = [];
let enemies = [];
let particles = [];
let powerUps = [];
let explosions = [];

// 输入处理
const keys = {};
let lastShot = 0;
const shootCooldown = 100;

// 音效系统 - 改进版
class AudioManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.audioContext = null;
        this.initSounds();
    }

    initSounds() {
        try {
            // 使用Web Audio API创建音效
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // 改进的音效参数 - 更好听的音效
            this.soundParams = {
                shoot: { 
                    freq: [440, 880], // 双音调
                    duration: 0.15, 
                    type: 'sine',
                    volume: 0.3
                },
                hit: { 
                    freq: [200, 150, 100], // 下降音调
                    duration: 0.2, 
                    type: 'triangle',
                    volume: 0.4
                },
                explosion: { 
                    freq: [80, 60, 40], // 低频爆炸音
                    duration: 0.6, 
                    type: 'sawtooth',
                    volume: 0.5
                },
                powerup: { 
                    freq: [523, 659, 784], // 上升音阶
                    duration: 0.4, 
                    type: 'sine',
                    volume: 0.3
                },
                damage: { 
                    freq: [220, 110], // 警告音
                    duration: 0.3, 
                    type: 'square',
                    volume: 0.4
                }
            };
        } catch (e) {
            console.log('Audio not supported');
            this.enabled = false;
        }
    }

    playSound(soundName) {
        if (!this.enabled || !this.audioContext) return;

        try {
            const params = this.soundParams[soundName];
            if (!params) return;

            // 如果音频上下文被暂停，尝试恢复
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            const frequencies = Array.isArray(params.freq) ? params.freq : [params.freq];

            frequencies.forEach((freq, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();

                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);

                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime + index * 0.05);
                oscillator.type = params.type;

                const startTime = this.audioContext.currentTime + index * 0.05;
                const endTime = startTime + params.duration / frequencies.length;

                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(params.volume, startTime + 0.01);
                gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

                oscillator.start(startTime);
                oscillator.stop(endTime);
            });
        } catch (e) {
            console.log('Audio error:', e);
        }
    }

    // 启用音频上下文（需要用户交互）
    enableAudio() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
}

const audioManager = new AudioManager();

// 武器系统 - 增强版
const weapons = {
    normal: { 
        name: '普通子弹', 
        damage: 12, 
        speed: 9,          // 飞行速度中等
        cooldown: 300,      // 射速中等
        color: '#00ffff',
        ammo: -1, // 无限弹药
        maxAmmo: -1,
        description: '无限弹药，稳定可靠'
    },
    rocket: { 
        name: '火箭弹', 
        damage: 80,         // 增加伤害
        speed: 8,           // 飞行速度较慢
        cooldown: 800,      // 射速很慢
        color: '#ff8800',
        ammo: 0,
        maxAmmo: 20, // 弹药较少
        description: '范围爆炸，威力巨大'
    },
    laser: { 
        name: '激光炮', 
        damage: 35, 
        speed: 10,          // 飞行速度中等
        cooldown: 300,      // 射速中等偏慢
        color: '#ff0080',
        ammo: 0,
        maxAmmo: 100, // 测试阶段：增加弹药 (正式版改为50)
        description: '超高伤害，穿透敌人'
    },
    spread: { 
        name: '散弹枪', 
        damage: 20,         // 初始伤害增加
        speed: 8,           // 飞行速度中等偏慢
        cooldown: 350,      // 射速慢
        color: '#00ff80',
        ammo: 0,
        maxAmmo: 160, // 测试阶段：增加弹药 (正式版改为80)
        description: '范围攻击，多发弹丸'
    }
};
let currentWeapon = 'normal';

// 玩家飞船类 - 直接响应移动系统
class Player {
    constructor() {
        this.x = canvas.width / 2;
        this.y = canvas.height - 100;
        this.width = 50;
        this.height = 50;
        this.speed = 4;
        this.health = 100;
        this.maxHealth = 100;
        this.invulnerable = 0;
        this.maxSpeed = 6;
        // 优化方案：方向向量 + 惯性系统
        this.velocity = { x: 0, y: 0 };
        this.direction = { x: 0, y: 0 }; // 当前方向向量
        this.lerpFactor = 0.3; // 方向插值因子，更平滑的转向
        this.friction = 0.85; // 摩擦力，提供轻微惯性
    }

    update() {
        // 方案A：轻量级插值移动系统 - 速度平衡调整
        let targetVelocityX = 0;
        let targetVelocityY = 0;
        const moveStep = this.maxSpeed * 0.7; // 提高直向移动速度

        // 检测输入，设置目标速度
        if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
            targetVelocityX = -moveStep;
        }
        if (keys['ArrowRight'] || keys['d'] || keys['D']) {
            targetVelocityX = moveStep;
        }
        if (keys['ArrowUp'] || keys['w'] || keys['W']) {
            targetVelocityY = -moveStep;
        }
        if (keys['ArrowDown'] || keys['s'] || keys['S']) {
            targetVelocityY = moveStep * 1.2; // 后退速度稍快一些
        }

        // 斜向移动速度调整（明显慢于直向移动）
        if (targetVelocityX !== 0 && targetVelocityY !== 0) {
            const diagonalFactor = 0.65; // 斜向移动慢40%，确保比直向慢
            targetVelocityX *= diagonalFactor;
            targetVelocityY *= diagonalFactor;
        }

        // 速度插值，提供轻微的平滑效果
        this.velocity.x += (targetVelocityX - this.velocity.x) * this.lerpFactor;
        this.velocity.y += (targetVelocityY - this.velocity.y) * this.lerpFactor;

        // 更新位置
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // 边界检测
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
        this.y = Math.max(0, Math.min(canvas.height - this.height, this.y));

        // 射击
        if (keys[' '] && Date.now() - lastShot > weapons[currentWeapon].cooldown) {
            this.shoot();
            lastShot = Date.now();
        }

        // 减少无敌时间
        if (this.invulnerable > 0) {
            this.invulnerable--;
        }

        // 护盾系统更新
        this.updateShield();
    }

    // 护盾系统更新
    updateShield() {
        if (playerUpgrades.levelBased.shield > 0) {
            const config = UPGRADE_CONFIG.shield;
            const shieldLevel = playerUpgrades.levelBased.shield;

            // 计算护盾参数
            const maxShield = config.baseShield + (shieldLevel - 1) * config.shieldPerLevel;
            const cooldown = config.baseCooldown - (shieldLevel - 1) * config.cooldownReduction;

            // 如果护盾未激活且距离上次受伤时间足够长，激活护盾
            if (!playerState.shieldActive && Date.now() - playerState.lastDamageTime > cooldown) {
                playerState.shieldActive = true;
                playerState.shieldValue = maxShield;
                console.log(`护盾激活！护盾值: ${playerState.shieldValue}`);
            }
        }
    }

    shoot() {
        const weapon = weapons[currentWeapon];

        // 检查弹药（普通子弹无限）
        if (weapon.ammo === 0) {
            // 弹药用完，自动切换到普通子弹
            currentWeapon = 'normal';
            updateUI();
            return;
        }

        audioManager.playSound('shoot');

        // 消耗弹药（普通子弹不消耗）
        if (weapon.ammo > 0) {
            weapon.ammo--;
        }

        switch(currentWeapon) {
            case 'normal':
                // 普通子弹改为三发散射
                for(let i = -1; i <= 1; i++) {
                    bullets.push(new Bullet(
                        this.x + this.width/2, 
                        this.y, 
                        i * 0.5, // 散射角度0.5
                        -weapon.speed, 
                        weapon.damage, 
                        weapon.color
                    ));
                }
                break;
            case 'rocket':
                // 火箭弹 - 单发大威力
                bullets.push(new Bullet(
                    this.x + this.width/2, 
                    this.y, 
                    0, 
                    -weapon.speed, 
                    weapon.damage, 
                    weapon.color, 
                    'rocket'
                ));
                break;
            case 'laser':
                // 激光炮 - 双发平行激光
                bullets.push(new Bullet(
                    this.x + this.width/2 - 8, 
                    this.y, 
                    0, 
                    -weapon.speed, 
                    weapon.damage, 
                    weapon.color, 
                    'laser'
                ));
                bullets.push(new Bullet(
                    this.x + this.width/2 + 8, 
                    this.y, 
                    0, 
                    -weapon.speed, 
                    weapon.damage, 
                    weapon.color, 
                    'laser'
                ));
                break;
            case 'spread':
                // 散弹枪发射9发子弹，但只消耗1发弹药，角度收缩，射程较近
                // 限制场上最多存在60发散弹枪子弹
                const spreadBullets = bullets.filter(b => b.type === 'spread');
                if (spreadBullets.length > 40) {
                    // 移除最早的散弹枪子弹
                    const firstIndex = bullets.findIndex(b => b.type === 'spread');
                    if (firstIndex !== -1) bullets.splice(firstIndex, 1);
                }
                for(let i = -2; i <= 2; i++) {
                    const bullet = new Bullet(this.x + this.width/2, this.y, i * 1.5, -weapon.speed, weapon.damage*2.0, weapon.color, 'spread');
                    bullet.life = 70; // 射程较近
                    bullets.push(bullet);
                }
                break;
        }

        this.createMuzzleFlash();
        updateUI(); // 更新弹药显示
    }

    createMuzzleFlash() {
        for(let i = 0; i < 8; i++) {
            particles.push(new Particle(
                this.x + this.width/2,
                this.y,
                (Math.random() - 0.5) * 6,
                -Math.random() * 4,
                weapons[currentWeapon].color,
                25
            ));
        }
    }

    takeDamage(damage) {
        if (this.invulnerable <= 0) {
            // 记录受伤时间
            playerState.lastDamageTime = Date.now();

            // 如果有护盾，先消耗护盾
            if (playerState.shieldActive && playerState.shieldValue > 0) {
                if (playerState.shieldValue >= damage) {
                    // 护盾完全吸收伤害
                    playerState.shieldValue -= damage;
                    console.log(`护盾吸收伤害 ${damage}，剩余护盾: ${playerState.shieldValue}`);

                    // 护盾破碎检查
                    if (playerState.shieldValue <= 0) {
                        playerState.shieldActive = false;
                        playerState.shieldValue = 0;
                        console.log('护盾破碎！');

                        // 护盾破碎特效
                        for(let i = 0; i < 20; i++) {
                particles.push(new Particle(
                    this.x + Math.random() * this.width,
                    this.y + Math.random() * this.height,
                                (Math.random() - 0.5) * 10,
                                (Math.random() - 0.5) * 10,
                                '#00ffff',
                                30
                ));
            }
        }

                    // 护盾受击特效
        for(let i = 0; i < 8; i++) {
            particles.push(new Particle(
                this.x + Math.random() * this.width,
                this.y + Math.random() * this.height,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                            '#00ffff',
                            20
                        ));
        }

                    return; // 护盾吸收了所有伤害，不扣血
        } else {
                    // 护盾部分吸收伤害
                    damage -= playerState.shieldValue;
                    console.log(`护盾吸收 ${playerState.shieldValue} 伤害，剩余伤害: ${damage}`);
                    playerState.shieldActive = false;
                    playerState.shieldValue = 0;

                    // 护盾破碎特效
                    for(let i = 0; i < 20; i++) {
            particles.push(new Particle(
                            this.x + Math.random() * this.width,
                            this.y + Math.random() * this.height,
                            (Math.random() - 0.5) * 10,
                            (Math.random() - 0.5) * 10,
                            '#00ffff',
                            30
                        ));
        }
    }
            }

            // 扣除生命值
            this.health -= damage;
            this.invulnerable = 90; // 1.5秒无敌时间            
            // 幽灵道具效果：受伤时获得额外无敌时间
            if (playerUpgrades.levelBased.ghost > 0) {
                const config = UPGRADE_CONFIG.ghost;
                this.invulnerable = Math.max(this.invulnerable, config.invulnerabilityTime);
                console.log(`幽灵效果触发！无敌时间延长至 ${this.invulnerable} 帧`);
            }

            audioManager.playSound('damage');

            // 受伤特效
            for(let i = 0; i < 15; i++) {
                particles.push(new Particle(
                    this.x + Math.random() * this.width,
                    this.y + Math.random() * this.height,
                    (Math.random() - 0.5) * 8,
                    (Math.random() - 0.5) * 8,
                    '#ff0040',
                    40
                ));
            }
        }
    }

    draw() {
        ctx.save();

        // 无敌时闪烁效果
        if (this.invulnerable > 0 && Math.floor(this.invulnerable / 5) % 2) {
            ctx.globalAlpha = 0.5;
        }

        // 绘制护盾光环（在飞船之前绘制）
        if (playerState.shieldActive && playerState.shieldValue > 0) {
            this.drawShield();
        }

        // 绘制更详细的飞船
        this.drawDetailedShip();

        // 引擎粒子
        if (Math.random() < 0.8) {
            particles.push(new Particle(
                this.x + 12 + Math.random() * 26,
                this.y + this.height + 5,
                (Math.random() - 0.5) * 3,
                Math.random() * 4 + 3,
                Math.random() < 0.5 ? '#ff8000' : '#ffff00',
                20
            ));
        }

        ctx.restore();
    }

    // 绘制护盾效果
    drawShield() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const shieldRadius = 35;

        // 护盾透明度基于护盾值
        const config = UPGRADE_CONFIG.shield;
        const shieldLevel = playerUpgrades.levelBased.shield;
        const maxShield = config.baseShield + (shieldLevel - 1) * config.shieldPerLevel;
        const shieldAlpha = (playerState.shieldValue / maxShield) * 0.6 + 0.2;
        ctx.save();
        ctx.globalAlpha = shieldAlpha;

        // 护盾外圈
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(centerX, centerY, shieldRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 护盾内部填充
        ctx.fillStyle = '#00ffff';
        ctx.globalAlpha = shieldAlpha * 0.3;
            ctx.beginPath();
        ctx.arc(centerX, centerY, shieldRadius, 0, Math.PI * 2);
            ctx.fill();

        // 护盾闪烁效果
        if (Math.random() < 0.3) {
            ctx.globalAlpha = shieldAlpha * 0.8;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(centerX, centerY, shieldRadius + 2, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawDetailedShip() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        ctx.save();

        // 主引擎粒子尾焰（在战机后面）
        this.drawEngineParticles();

        // 战机主体 - 科幻流线型设计
        this.drawSciFiHull(centerX, centerY);

        // 武器系统发光效果
        this.drawWeaponSystems(centerX, centerY);

        // 驾驶舱和细节
        this.drawCockpitDetails(centerX, centerY);

        // 整体发光轮廓
        this.drawGlowOutline(centerX, centerY);

        ctx.restore();
    }

    drawEngineParticles() {
        // 主引擎粒子
        for(let i = 0; i < 3; i++) {
            const engineX = this.x + 15 + i * 10;
            const engineY = this.y + this.height + 2;

            // 创建引擎粒子
            if (Math.random() < 0.8) {
                particles.push(new Particle(
                    engineX + (Math.random() - 0.5) * 8,
                    engineY + Math.random() * 8,
                    (Math.random() - 0.5) * 2,
                    Math.random() * 6 + 2,
                    Math.random() < 0.6 ? '#00aaff' : '#ffffff',
                    25
                ));
            }
        }

        // 侧推进器粒子（移动时）
        if (Math.abs(this.velocity.x) > 1) {
            const sideEngineY = this.y + this.height * 0.7;
            const direction = this.velocity.x > 0 ? -1 : 1;
            const sideEngineX = direction > 0 ? this.x - 5 : this.x + this.width + 5;

            particles.push(new Particle(
                sideEngineX,
                sideEngineY,
                direction * (Math.random() * 3 + 2),
                (Math.random() - 0.5) * 2,
                '#00ffaa',
                15
            ));
        }
    }

    drawSciFiHull(centerX, centerY) {
        // 第五代隐形战斗机设计 - F-22猛禽风格
        ctx.fillStyle = '#2a3d4d';
        ctx.strokeStyle = '#4da6ff';
        ctx.lineWidth = 1.5;

        // 主机身 - F-22隐形战斗机流线型
        ctx.beginPath();
        ctx.moveTo(centerX, this.y); // 锋利尖头
        
        // 左侧机身轮廓
        ctx.quadraticCurveTo(centerX - 8, this.y + 6, centerX - 14, this.y + 16);
        ctx.lineTo(centerX - 12, this.y + 28);
        ctx.quadraticCurveTo(centerX - 10, this.y + 40, centerX - 8, this.y + 48);
        ctx.lineTo(centerX - 4, this.y + 50);
        
        // 机身底部
        ctx.lineTo(centerX + 4, this.y + 50);
        
        // 右侧机身轮廓
        ctx.quadraticCurveTo(centerX + 10, this.y + 40, centerX + 12, this.y + 28);
        ctx.lineTo(centerX + 14, this.y + 16);
        ctx.quadraticCurveTo(centerX + 8, this.y + 6, centerX, this.y);
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // F-22式三角翼设计 - 隐形战斗机特征
        ctx.fillStyle = '#1a2d3d';
        ctx.strokeStyle = '#4da6ff';
        ctx.lineWidth = 1;

        // 左三角翼 - F-22特色后掠角
        ctx.beginPath();
        ctx.moveTo(centerX - 12, this.y + 22);
        ctx.lineTo(centerX - 28, this.y + 32);
        ctx.lineTo(centerX - 24, this.y + 42);
        ctx.lineTo(centerX - 10, this.y + 38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 右三角翼
        ctx.beginPath();
        ctx.moveTo(centerX + 12, this.y + 22);
        ctx.lineTo(centerX + 28, this.y + 32);
        ctx.lineTo(centerX + 24, this.y + 42);
        ctx.lineTo(centerX + 10, this.y + 38);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 前翼（鸭翼）- 现代战斗机特征
        ctx.fillStyle = '#334d5d';
        ctx.beginPath();
        ctx.moveTo(centerX - 8, this.y + 12);
        ctx.lineTo(centerX - 16, this.y + 16);
        ctx.lineTo(centerX - 14, this.y + 20);
        ctx.lineTo(centerX - 6, this.y + 18);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(centerX + 8, this.y + 12);
        ctx.lineTo(centerX + 16, this.y + 16);
        ctx.lineTo(centerX + 14, this.y + 20);
        ctx.lineTo(centerX + 6, this.y + 18);
        ctx.closePath();
        ctx.fill();

        // 垂直尾翼
        ctx.fillStyle = '#1a4d66';
        ctx.beginPath();
        ctx.moveTo(centerX - 3, this.y + 45);
        ctx.lineTo(centerX - 8, this.y + 35);
        ctx.lineTo(centerX - 5, this.y + 30);
        ctx.lineTo(centerX, this.y + 35);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX + 3, this.y + 45);
        ctx.lineTo(centerX + 8, this.y + 35);
        ctx.lineTo(centerX + 5, this.y + 30);
        ctx.lineTo(centerX, this.y + 35);
        ctx.closePath();
        ctx.fill();

        // 机身装甲线条
        ctx.strokeStyle = '#4da6ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - 10, this.y + 12);
        ctx.lineTo(centerX + 10, this.y + 12);
        ctx.moveTo(centerX - 14, this.y + 22);
        ctx.lineTo(centerX + 14, this.y + 22);
        ctx.moveTo(centerX - 12, this.y + 32);
        ctx.lineTo(centerX + 12, this.y + 32);
        ctx.stroke();

        // 进气口
        ctx.fillStyle = '#003366';
        ctx.fillRect(centerX - 6, this.y + 18, 3, 8);
        ctx.fillRect(centerX + 3, this.y + 18, 3, 8);
    }

    drawWeaponSystems(centerX, centerY) {
        // 根据当前武器显示不同的武器系统
        const weaponColor = weapons[currentWeapon].color;

        // 主武器发射口
        ctx.fillStyle = weaponColor;
        ctx.shadowColor = weaponColor;
        ctx.shadowBlur = 8;

        // 中央武器口
        ctx.beginPath();
        ctx.arc(centerX, this.y - 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // 侧武器口
        ctx.beginPath();
        ctx.arc(centerX - 8, this.y + 5, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX + 8, this.y + 5, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        // 武器充能效果
        if (Date.now() - lastShot < 200) {
            ctx.fillStyle = weaponColor;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.arc(centerX, this.y - 2, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    drawCockpitDetails(centerX, centerY) {
        // 驾驶舱
        ctx.fillStyle = '#66ccff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.arc(centerX, this.y + 15, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 驾驶舱内部细节
        ctx.fillStyle = '#003d4d';
        ctx.beginPath();
        ctx.arc(centerX, this.y + 15, 4, 0, Math.PI * 2);
        ctx.fill();

        // 状态指示灯
        ctx.fillStyle = this.health > 50 ? '#00ff00' : '#ff4400';
        ctx.beginPath();
        ctx.arc(centerX - 2, this.y + 13, 1, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#00aaff';
        ctx.beginPath();
        ctx.arc(centerX + 2, this.y + 13, 1, 0, Math.PI * 2);
        ctx.fill();
    }

    drawGlowOutline(centerX, centerY) {
        // 整体发光轮廓效果
        ctx.strokeStyle = '#00aaff';
        ctx.lineWidth = 1;
        ctx.shadowColor = '#00aaff';
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.8;

        ctx.beginPath();
        ctx.moveTo(centerX, this.y);
        ctx.quadraticCurveTo(centerX - 20, this.y + 15, centerX - 15, this.y + 30);
        ctx.lineTo(centerX - 8, this.y + 45);
        ctx.lineTo(centerX + 8, this.y + 45);
        ctx.quadraticCurveTo(centerX + 20, this.y + 15, centerX, this.y);
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }
}

// 子弹类 - 增强视觉效果
class Bullet {
    constructor(x, y, vx, vy, damage, color, type = 'normal') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.color = color;
        this.type = type;
        this.width = type === 'laser' ? 6 : (type === 'rocket' ? 8 : 4);
        this.height = type === 'laser' ? 25 : (type === 'rocket' ? 16 : 12);
        this.isEnemyBullet = false;

        // 命中记录系统 - 防止激光多次伤害同一目标
        this.hitTargets = new Set();

        // 根据武器类型设置不同的射程
        switch(type) {
            case 'laser':
                this.life = 120; // 激光射程较远
                break;
            case 'normal':
                this.life = 70; // 普通子弹射程中等
                break;
            case 'rapid':
                this.life = 140; // 速射炮射程较远
                break;
            default:
                this.life = 120; // 默认射程
        }

        this.trail = [];
    }

    update() {
        // 记录轨迹
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 3) {
            this.trail.shift();
        }

        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        // 激光特效
        if (this.type === 'laser' && Math.random() < 0.4) {
            particles.push(new Particle(
                this.x + (Math.random() - 0.5) * this.width,
                this.y + (Math.random() - 0.5) * this.height,
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3,
                this.color,
                15
            ));
        }
    }

    draw() {
        ctx.save();

        // 绘制轨迹
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }

        // 根据武器类型绘制不同的子弹效果
        ctx.globalAlpha = 1;

        switch(this.type || 'normal') {
            case 'normal':
                this.drawEnergyBullet();
                break;
            case 'rocket':
                this.drawRocketBullet();
                break;
            case 'laser':
                this.drawLaserBullet();
                break;
            case 'spread':
                this.drawFragmentBullet();
                break;
            default:
                this.drawEnergyBullet();
        }

        ctx.restore();
    }

    drawEnergyBullet() {
        // 普通子弹：蓝色能量弹
        const pulseIntensity = Math.sin(Date.now() * 0.01) * 0.3 + 0.7;

        // 外层光晕
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12 * pulseIntensity;
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width * 1.5, 0, Math.PI * 2);
        ctx.fill();

        // 内层能量核心
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // 能量核心
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    // drawPulseBullet() {
    //     // 速射炮：黄色脉冲弹
    //     const time = Date.now() * 0.02;
    //     const pulseIntensity = Math.sin(time) * 0.5 + 0.5;

    //     // 电弧效果
    //     ctx.strokeStyle = this.color;
    //     ctx.lineWidth = 2;
    //     ctx.shadowColor = this.color;
    //     ctx.shadowBlur = 10;

    //     for(let i = 0; i < 4; i++) {
    //         const angle = (i / 4) * Math.PI * 2 + time;
    //         const x1 = this.x + Math.cos(angle) * this.width;
    //         const y1 = this.y + Math.sin(angle) * this.width;
    //         const x2 = this.x + Math.cos(angle + Math.PI) * this.width * 0.5;
    //         const y2 = this.y + Math.sin(angle + Math.PI) * this.width * 0.5;

    //         ctx.beginPath();
    //         ctx.moveTo(x1, y1);
    //         ctx.lineTo(x2, y2);
    //         ctx.stroke();
    //     }

    //     // 中心能量球
    //     ctx.fillStyle = this.color;
    //     ctx.shadowBlur = 15 * pulseIntensity;
    //     ctx.beginPath();
    //     ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
    //     ctx.fill();

    //     ctx.shadowBlur = 0;
    // }

    drawLaserBullet() {
        // 激光炮：保持原有效果（你说满意）
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20;
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);

        // 内核
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x - this.width/4, this.y - this.height/2, this.width/2, this.height);

        ctx.shadowBlur = 0;
    }

    drawFragmentBullet() {
        // 散弹枪：绿色能量碎片 - 加粗版本
        const time = Date.now() * 0.015;

        // 碎片主体 - 更大更厚重
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;

        // 不规则厚重碎片形状
        const size = this.width * 1.5; // 增大尺寸
        ctx.beginPath();
        ctx.moveTo(this.x + Math.cos(time) * size, this.y + Math.sin(time) * size);
        ctx.lineTo(this.x + Math.cos(time + 1.5) * size * 0.8, this.y + Math.sin(time + 1.5) * size * 0.8);
        ctx.lineTo(this.x + Math.cos(time + 3) * size * 0.6, this.y + Math.sin(time + 3) * size * 0.6);
        ctx.lineTo(this.x + Math.cos(time + 4.5) * size * 0.7, this.y + Math.sin(time + 4.5) * size * 0.7);
        ctx.closePath();
        ctx.fill();

        // 内核 - 更亮的核心
        ctx.fillStyle = '#80ff80';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, size * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // 能量粒子
        if (Math.random() < 0.2) { // 微降特效数量
            particles.push(new Particle(
                this.x + (Math.random() - 0.5) * size,
                this.y + (Math.random() - 0.5) * size,
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3,
                this.color,
                12
            ));
        }

        ctx.shadowBlur = 0;
    }

    drawRocketBullet() {
        // 火箭弹：橙色火焰弹头+尾焰
        // 主体
        ctx.save();
        ctx.fillStyle = '#ff8800';
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, this.width * 1.2, this.height * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        // 弹头
        ctx.fillStyle = '#fff2cc';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - this.height * 0.2, this.width * 0.5, this.height * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();

        // 尾焰
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#ff8000';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + this.height * 0.4, this.width * 0.7, this.height * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.restore();

        // 火焰粒子
        if (Math.random() < 0.5) {
            particles.push(new Particle(
                this.x + (Math.random() - 0.5) * this.width * 0.8,
                this.y + this.height * 0.5 + Math.random() * 4,
                (Math.random() - 0.5) * 2,
                Math.random() * 2 + 1,
                '#ff8000',
                18
            ));
        }
    }

    isOffScreen() {
        return this.y < -this.height || this.y > canvas.height + this.height || 
               this.x < -this.width || this.x > canvas.width + this.width || this.life <= 0;
    }
}

// 敌人类 - 增强视觉效果
class Enemy {
    constructor(type = 'basic') {
        this.type = type;
        this.x = Math.random() * (canvas.width - 60);
        this.y = -60;
        this.lastShot = 0;
        this.animFrame = 0;

        switch(type) {
            case 'basic':
                this.width = 40;
                this.height = 40;
                this.speed = 2 + Math.random() * 2;
                this.health = 25;
                this.maxHealth = 25;
                this.color = '#ff4040';
                this.shootCooldown = 1200;
                this.points = 10;
            break;
            case 'fast':
                this.width = 35;
                this.height = 35;
                this.speed = 4 + Math.random() * 2;
                this.health = 20;
                this.maxHealth = 20;
                this.color = '#ff8040';
                this.shootCooldown = 900;
                this.points = 15;
                break;
            case 'heavy':
                this.width = 60;
                this.height = 60;
                this.speed = 1 + Math.random();
                this.health = 60;
                this.maxHealth = 60;
                this.color = '#8040ff';
                this.shootCooldown = 1800;
                this.points = 30;
            break;
            case 'boss':
                this.width = 120;
                this.height = 80;
                this.speed = 1.5;
                this.health = 250;
                this.maxHealth = 250;
                this.color = '#ff0080';
                this.shootCooldown = 600;
                this.points = 100;
                this.x = canvas.width / 2 - this.width / 2;
            break;
        }
    }

    update() {
        this.animFrame++;

        // 移动模式
        if (this.type === 'boss') {
            this.x += Math.sin(Date.now() * 0.003) * 3;
            this.y = Math.min(120, this.y + this.speed);
        } else {
            this.y += this.speed * gameSpeed;

            // 快速敌人的左右移动
            if (this.type === 'fast') {
                this.x += Math.sin(this.y * 0.03) * 2.5;
            }
        }

        // 边界检测
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));

        // 射击
        if (Date.now() - this.lastShot > this.shootCooldown) {
            this.shoot();
            this.lastShot = Date.now();
        }
    }

    shoot() {
        if (this.type === 'boss') {
            // Boss多方向射击
            for(let i = -2; i <= 2; i++) {
                bullets.push(new EnemyBullet(this.x + this.width/2, this.y + this.height, i * 3, 5, 'boss'));
            }
        } else if (this.type === 'fast') {
            bullets.push(new EnemyBullet(this.x + this.width/2, this.y + this.height, 0, 4, 'fast'));
        } else if (this.type === 'heavy') {
            bullets.push(new EnemyBullet(this.x + this.width/2, this.y + this.height, 0, 4, 'heavy'));
        } else {
            bullets.push(new EnemyBullet(this.x + this.width/2, this.y + this.height, 0, 4, 'basic'));
        }
    }

    takeDamage(damage) {
        // 限制血量不能为负数
        this.health = Math.max(0, this.health - damage);
        audioManager.playSound('hit');

        // 受伤特效
        for(let i = 0; i < 8; i++) {
            particles.push(new Particle(
                this.x + Math.random() * this.width,
                this.y + Math.random() * this.height,
                (Math.random() - 0.5) * 6,
                (Math.random() - 0.5) * 6,
                this.color,
                25
            ));
        }
    }

    draw() {
        ctx.save();

        // 绘制详细的敌人
        this.drawDetailedEnemy();

        // 血条
        if (this.health < this.maxHealth) {
            const barWidth = this.width;
            const barHeight = 6;
            const barY = this.y - 12;

            ctx.fillStyle = '#ff0000';
            ctx.fillRect(this.x, barY, barWidth, barHeight);
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(this.x, barY, barWidth * (this.health / this.maxHealth), barHeight);

            // 血条边框
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(this.x, barY, barWidth, barHeight);
        }

        ctx.restore();
    }

    drawDetailedEnemy() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        // 主体
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;

        if (this.type === 'boss') {
            // Boss样式 - 复杂形状
            ctx.fillRect(this.x + 20, this.y, this.width - 40, this.height);
            ctx.fillRect(this.x, this.y + 20, this.width, this.height - 40);

            // Boss装甲
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(centerX - 10, centerY - 10, 20, 20);
        } else {
            // 普通敌人 - 六边形
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3;
                const x = centerX + Math.cos(angle) * (this.width / 2);
                const y = centerY + Math.sin(angle) * (this.height / 2);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        }

        // 武器点
        ctx.fillStyle = '#ffff00';
        if (this.type === 'boss') {
            ctx.fillRect(centerX - 15, this.y + this.height - 5, 8, 8);
            ctx.fillRect(centerX + 7, this.y + this.height - 5, 8, 8);
        } else {
            ctx.fillRect(centerX - 3, this.y + this.height - 5, 6, 8);
        }

        ctx.shadowBlur = 0;
    }

    isOffScreen() {
        return this.y > canvas.height + this.height;
    }

    isDead() {
        return this.health <= 0;
    }
}

//  // 敌人子弹类 - 增强效果
// class EnemyBullet {
//     constructor(x, y, vx, vy, enemyType = 'basic') {
//         this.x = x;
//         this.y = y;
//         this.vx = vx;
//         this.vy = vy;
//         this.width = 6;
//         this.height = 10;
//         this.color = '#ff4040';
//         this.trail = [];
//         this.enemyType = enemyType; // 添加敌人类型标记
//     }

//     update() {
//         this.trail.push({ x: this.x, y: this.y });
//         if (this.trail.length > 5) {
//             this.trail.shift();
//         }

//         this.x += this.vx;
//         this.y += this.vy;
//     }

//     draw() {
//         ctx.save();

//         // 轨迹
//         if (this.trail.length > 1) {
//             ctx.strokeStyle = this.color;
//             ctx.lineWidth = 2;
//             ctx.globalAlpha = 0.3;
//             ctx.beginPath();
//             ctx.moveTo(this.trail[0].x, this.trail[0].y);
//             for (let i = 1; i < this.trail.length; i++) {
//                 ctx.lineTo(this.trail[i].x, this.trail[i].y);
//             }
//             ctx.stroke();
//         }

//         // 根据敌人类型绘制不同的子弹效果
//         ctx.globalAlpha = 1;

//         switch(this.enemyType) {
//             case 'basic':
//                 this.drawPlasmaBullet();
//                 break;
//             case 'fast':
//                 this.drawPulseBullet();
//                 break;
//             case 'heavy':
//                 this.drawHeavyCannonBullet();
//                 break;
//             case 'sniper':
//                 this.drawSniperBullet();
//                 break;
//             case 'boss':
//                 this.drawBossBullet();
//                 break;
//             default:
//                 this.drawPlasmaBullet();
//         }

//         ctx.restore();
//     }

//     drawPlasmaBullet() {
//         // 基础敌人：红色等离子弹
//         ctx.fillStyle = this.color;
//         ctx.shadowColor = this.color;
//         ctx.shadowBlur = 8;

//         // 主等离子球
//         ctx.beginPath();
//         ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
//         ctx.fill();

//         // 火花粒子效果
//         if (Math.random() < 0.4) {
//             particles.push(new Particle(
//                 this.x + (Math.random() - 0.5) * this.width,
//                 this.y + (Math.random() - 0.5) * this.width,
//                 (Math.random() - 0.5) * 2,
//                 (Math.random() - 0.5) * 2,
//                 '#ff6666',
//                 15
//             ));
//         }

//         // 内核
//         ctx.fillStyle = '#ffaaaa';
//         ctx.shadowBlur = 4;
//         ctx.beginPath();
//         ctx.arc(this.x, this.y, this.width * 0.5, 0, Math.PI * 2);
//         ctx.fill();

//         ctx.shadowBlur = 0;
//     }

//     drawPulseBullet() {
//         // 快速敌人：橙色脉冲弹
//         const time = Date.now() * 0.02;

//         // 电弧效果
//         ctx.strokeStyle = '#ff8800';
//         ctx.lineWidth = 2;
//         ctx.shadowColor = '#ff8800';
//         ctx.shadowBlur = 12;

//         for(let i = 0; i < 3; i++) {
//             const angle = (i / 3) * Math.PI * 2 + time;
//             const x1 = this.x + Math.cos(angle) * this.width * 1.5;
//             const y1 = this.y + Math.sin(angle) * this.width * 1.5;

//             ctx.beginPath();
//             ctx.moveTo(this.x, this.y);
//             ctx.lineTo(x1, y1);
//             ctx.stroke();
//         }

//         // 中心脉冲球
//         ctx.fillStyle = '#ff8800';
//         ctx.shadowBlur = 15;
//         ctx.beginPath();
//         ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
//         ctx.fill();

//         ctx.shadowBlur = 0;
//     }

//     drawHeavyCannonBullet() {
//         // 重型敌人：紫色重炮弹
//         const pulseIntensity = Math.sin(Date.now() * 0.015) * 0.3 + 0.7;

//         // 扭曲空间效果
//         ctx.fillStyle = '#8040ff';
//         ctx.shadowColor = '#8040ff';
//         ctx.shadowBlur = 20 * pulseIntensity;
//         ctx.globalAlpha = 0.8;

//         // 大型能量球
//         ctx.beginPath();
//         ctx.arc(this.x, this.y, this.width * 1.5, 0, Math.PI * 2);
//         ctx.fill();

//         // 内部扭曲环
//         ctx.globalAlpha = 1;
//         ctx.strokeStyle = '#aa66ff';
//         ctx.lineWidth = 3;
//         ctx.beginPath();
//         ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
//         ctx.stroke();

//         // 能量核心
//         ctx.fillStyle = '#ffffff';
//         ctx.shadowBlur = 10;
//         ctx.beginPath();
//         ctx.arc(this.x, this.y, this.width * 0.4, 0, Math.PI * 2);
//         ctx.fill();

//         ctx.shadowBlur = 0;
//     }

//     drawSniperBullet() {
//         // 狙击手：红色激光束（类似玩家激光但更细更快）
//         ctx.fillStyle = '#ff0000';
//         ctx.shadowColor = '#ff0000';
//         ctx.shadowBlur = 15;

//         // 激光主体
//         ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);

//         // 白色内核
//         ctx.fillStyle = '#ffffff';
//         ctx.fillRect(this.x - this.width/4, this.y - this.height/2, this.width/2, this.height);

//         // 激光头部光点
//         ctx.fillStyle = '#ff0000';
//         ctx.shadowBlur = 20;
//         ctx.beginPath();
//         ctx.arc(this.x, this.y - this.height/2, this.width, 0, Math.PI * 2);
//         ctx.fill();

//         ctx.shadowBlur = 0;
//     }

//     drawBossBullet() {
//         // Boss：威胁性能量弹
//         const time = Date.now() * 0.01;
//         const pulseIntensity = Math.sin(time) * 0.4 + 0.6;

//         // 外层威胁光环
//         ctx.fillStyle = this.color;
//         ctx.shadowColor = this.color;
//         ctx.shadowBlur = 15 * pulseIntensity;
//         ctx.globalAlpha = 0.7;
//         ctx.beginPath();
//         ctx.arc(this.x, this.y, this.width * 2, 0, Math.PI * 2);
//         ctx.fill();

//         // 主弹体
//         ctx.globalAlpha = 1;
//         ctx.fillStyle = this.color;
//         ctx.shadowBlur = 12;
//         ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);

//         // 能量波纹
//         ctx.strokeStyle = '#ffffff';
//         ctx.lineWidth = 2;
//         ctx.globalAlpha = pulseIntensity;
//         ctx.beginPath();
//         ctx.arc(this.x, this.y, this.width * 1.5, 0, Math.PI * 2);
//         ctx.stroke();

//         ctx.shadowBlur = 0;
//         ctx.globalAlpha = 1;
//     }

//     isOffScreen() {
//         return this.y > canvas.height + this.height || this.y < -this.height ||
//                this.x < -this.width || this.x > canvas.width + this.width;
//     }
// }

// 粒子效果类 - 增强
class Particle {
    constructor(x, y, vx, vy, color, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.life = life;
        this.maxLife = life;
        this.size = Math.random() * 4 + 1;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.2;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        this.vx *= 0.98;
        this.vy *= 0.98;
        this.rotation += this.rotationSpeed;
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);

        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// 爆炸效果类 - 增强
class Explosion {
    constructor(x, y, size = 40) {
        this.x = x;
        this.y = y;
        this.size = 0;
        this.maxSize = size;
        this.life = 40;
        this.maxLife = 40;
        this.particles = [];

        // 创建爆炸粒子
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: 0,
                y: 0,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 30,
                maxLife: 30,
                size: Math.random() * 3 + 1
            });
        }

        audioManager.playSound('explosion');
    }

    update() {
        this.size = this.maxSize * (1 - this.life / this.maxLife);
        this.life--;

        // 更新粒子
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx *= 0.95;
            particle.vy *= 0.95;
            particle.life--;
        });
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha;

        // 主爆炸圈
        ctx.fillStyle = '#ff4040';
        ctx.shadowColor = '#ff4040';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();

        // 内圈
        ctx.fillStyle = '#ffff40';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 0.6, 0, Math.PI * 2);
        ctx.fill();

        // 爆炸粒子
        this.particles.forEach(particle => {
            if (particle.life > 0) {
                const particleAlpha = particle.life / particle.maxLife;
                ctx.globalAlpha = particleAlpha * alpha;
                ctx.fillStyle = '#ff8040';
                ctx.fillRect(
                    this.x + particle.x - particle.size/2,
                    this.y + particle.y - particle.size/2,
                    particle.size,
                    particle.size
                );
    }
        });

        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// 清屏炸弹效果类
class BombEffect {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = canvas.width;
        this.life = 60;
        this.maxLife = 60;

        // 清除所有敌人子弹
        bullets = bullets.filter(bullet => bullet.vy <= 0); // 只保留玩家子弹

        // 播放音效
        audioManager.playSound('explosion');
    }
    update() {
        this.radius = this.maxRadius * (1 - this.life / this.maxLife);
        this.life--;
}

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.save();
        ctx.globalAlpha = alpha * 0.3;

        // 冲击波圆环
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 内部光效
        ctx.globalAlpha = alpha * 0.1;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}



// 火箭弹爆炸光环效果类
class RocketBlastEffect {
    constructor(x, y, maxRadius = 80) {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = maxRadius;
        this.life = 30; // 0.5秒持续时间
        this.maxLife = 30;
        this.innerRadius = 0;
        this.pulseIntensity = 1;
    }

    update() {
        // 冲击波扩散
        this.radius = this.maxRadius * (1 - this.life / this.maxLife);
        this.innerRadius = this.radius * 0.6;
        this.pulseIntensity = this.life / this.maxLife;
        this.life--;
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.save();

        // 外层橙红色冲击波
        ctx.strokeStyle = '#ff6600';
        ctx.lineWidth = 4;
        ctx.globalAlpha = alpha * 0.8;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();

        // 内层黄色光环
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha * 0.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.innerRadius, 0, Math.PI * 2);
        ctx.stroke();

        // 爆炸中心光晕
        ctx.fillStyle = '#ff8800';
        ctx.globalAlpha = alpha * this.pulseIntensity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 15 * this.pulseIntensity, 0, Math.PI * 2);
        ctx.fill();

        // 火花粒子
        if (this.life > 15) { // 前半段时间生成粒子
            for(let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2;
                const particleX = this.x + Math.cos(angle) * this.radius * 0.8;
                const particleY = this.y + Math.sin(angle) * this.radius * 0.8;

                particles.push(new Particle(
                    particleX + (Math.random() - 0.5) * 10,
                    particleY + (Math.random() - 0.5) * 10,
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 6,
                    Math.random() < 0.5 ? '#ff8800' : '#ffff00',
                    20
                ));
            }
        }

        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// 复活效果类
class ReviveEffect {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = 120;
        this.maxLife = 120;
        this.particles = [];

        // 创建复活粒子
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                x: 0,
                y: 0,
                vx: (Math.random() - 0.5) * 8,
                vy: (Math.random() - 0.5) * 8,
                life: 60,
                maxLife: 60,
                size: Math.random() * 6 + 2
            });
        }

        audioManager.playSound('powerup');
    }

    update() {
        this.life--;

        // 更新粒子
        this.particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vx *= 0.95;
            particle.vy *= 0.95;
            particle.life--;
        });
    }

    draw() {
        const alpha = this.life / this.maxLife;
        ctx.save();

        // 复活光环
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = '#00ff80';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 60 * (1 - alpha), 0, Math.PI * 2);
        ctx.stroke();

        // 复活粒子
        this.particles.forEach(particle => {
            if (particle.life > 0) {
                const particleAlpha = particle.life / particle.maxLife;
                ctx.globalAlpha = particleAlpha * alpha;
                ctx.fillStyle = '#00ff80';
                ctx.beginPath();
                ctx.arc(
                    this.x + particle.x,
                    this.y + particle.y,
                    particle.size,
                    0, Math.PI * 2
                );
                ctx.fill();
            }
        });

        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

// 清屏炸弹功能
function useBomb() {
    if (playerUpgrades.countBased.bomb > 0) {
        playerUpgrades.countBased.bomb--;
        explosions.push(new BombEffect(player.x + player.width/2, player.y + player.height/2));
        updateUI();
        console.log('Bomb used! Remaining:', playerUpgrades.countBased.bomb);
    }
}

// 复活玩家
function revivePlayer() {
    if (playerUpgrades.countBased.revive > 0) {
        playerUpgrades.countBased.revive--;

        // 触发时停效果
        gameState = 'reviving';
        // 复活处理
        player.health = player.maxHealth * 0.5; // 复活时恢复50%血量
        player.invulnerable = 240; // 4秒无敌时间（增加无敌时间）
        playerState.isReviving = true;

        // 复活特效
        explosions.push(new ReviveEffect(player.x + player.width/2, player.y + player.height/2));

        // 自动清屏两次（不消耗道具）
    setTimeout(() => {
            // 第一次清屏
            explosions.push(new BombEffect(player.x + player.width/2, player.y + player.height/2));
        }, 200);
    setTimeout(() => {
            // 第二次清屏
            explosions.push(new BombEffect(player.x + player.width/2, player.y + player.height/2));
        }, 600);

        // 1.5秒后恢复游戏
        setTimeout(() => {
            if (gameState === 'reviving') {
        gameState = 'playing';
                playerState.isReviving = false;
        }
        }, 1500);
    updateUI();
        console.log('Player revived! Remaining revives:', playerUpgrades.countBased.revive);
        return true;
        }
    return false;
}

// 道具类 - 增强视觉
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 25;
        this.height = 25;
        this.speed = 2;
        this.life = 400; // 约6.7秒后消失
        this.animFrame = 0;

        switch(type) {
            case 'health':
                this.color = '#00ff00';
                break;
            case 'weapon':
                this.color = '#ffff00';
                break;
            case 'score':
                this.color = '#00ffff';
                break;
        }
    }

    update() {
        this.y += this.speed;
        this.life--;
        this.animFrame++;

        // 发光粒子
        if (Math.random() < 0.3) {
            particles.push(new Particle(
                this.x + this.width/2 + (Math.random() - 0.5) * this.width,
                this.y + this.height/2 + (Math.random() - 0.5) * this.height,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                this.color,
                20
            ));
        }
    }

    draw() {
        ctx.save();

        // 旋转效果
        ctx.translate(this.x + this.width/2, this.y + this.height/2);
        ctx.rotate(this.animFrame * 0.05);

        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        ctx.fillRect(-this.width/2, -this.height/2, this.width, this.height);

        // 道具图标
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        const symbol = this.type === 'health' ? '+' : this.type === 'weapon' ? 'W' : '$';
        ctx.fillText(symbol, 0, 5);

        ctx.restore();
    }

    isOffScreen() {
        return this.y > canvas.height + this.height || this.life <= 0;
    }
}

/**
 * 吸血回血跳字效果
 */
function createHealText(x, y, amount) {
    const healText = document.createElement('div');
    healText.textContent = `+${amount}`;
    healText.style.position = 'absolute';

    // 获取游戏画布的位置
    const canvasRect = canvas.getBoundingClientRect();
    healText.style.left = `${canvasRect.left + x - 15}px`;
    healText.style.top = `${canvasRect.top + y - 25}px`;

    healText.style.color = '#00ff00';
    healText.style.fontWeight = 'bold';
    healText.style.fontSize = '24px';
    healText.style.pointerEvents = 'none';
    healText.style.textShadow = '0 0 12px #00ff00, 0 0 4px #fff, 0 0 8px #00ff00';
    healText.style.transition = 'transform 1s cubic-bezier(0.4,1.4,0.6,1), opacity 1s';
    healText.style.transform = 'translateY(0px) scale(1)';
    healText.style.opacity = '1';
    healText.style.zIndex = 1000;
    document.body.appendChild(healText);

    setTimeout(() => {
        healText.style.transform = 'translateY(-50px) scale(1.2)';
        healText.style.opacity = '0';
    }, 10);

    setTimeout(() => {
        if (healText.parentNode) healText.parentNode.removeChild(healText);
    }, 1100);
}
// 游戏主对象
const player = new Player();

// 碰撞检测
function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

/**
 * 生成敌人 - 使用增强系统
 * - 包含新敌人类型：狙击手、分裂敌人
 * - 多样化入场效果
 * - 最终Boss触发机制
 */
function spawnEnemies() {
    // 使用增强的敌人生成系统
    if (window.spawnEnhancedEnemies) {
        window.spawnEnhancedEnemies();
    } else {
        // 备用：原有系统
        if (Math.random() < 0.015 + level * 0.003) {
            let enemyType = 'basic';
            const rand = Math.random();

            if (level >= 5 && rand < 0.08) {
                enemyType = 'boss';
            } else if (level >= 3 && rand < 0.25) {
                enemyType = 'heavy';
            } else if (level >= 2 && rand < 0.55) {
                enemyType = 'fast';
    }

            enemies.push(new Enemy(enemyType));
}
    }
}

// 生成道具
function spawnPowerUps() {
    if (Math.random() < 0.003) {
        const types = ['health', 'weapon', 'score'];
        const type = types[Math.floor(Math.random() * types.length)];
        powerUps.push(new PowerUp(Math.random() * (canvas.width - 25), -25, type));
    }
}

/*
// 更新游戏逻辑
function update() {
    if (gameState !== 'playing') return;

    // 更新玩家
    player.update();

    // 更新游戏时间（用于Boss触发）
    if (window.updateGameTime) {
        window.updateGameTime();
    }
*/

// 更新游戏逻辑
function update() {
    if (gameState !== 'playing' && gameState !== 'reviving') return;

    // 复活状态时只更新特效，不更新游戏逻辑
    if (gameState === 'reviving') {
        // 只更新粒子和爆炸效果
        particles.forEach(particle => particle.update());
        particles = particles.filter(particle => !particle.isDead());

        explosions.forEach(explosion => explosion.update());
        explosions = explosions.filter(explosion => !explosion.isDead());

        return; // 不执行其他游戏逻辑
    }

    // 更新玩家
    player.update();

    // 更新游戏时间（用于Boss触发）
    if (window.updateGameTime) {
        window.updateGameTime();
    }

    // 更新子弹
    bullets = bullets.filter(bullet => {
        bullet.update();
        return !bullet.isOffScreen();
    });

    // 更新敌人
    enemies.forEach(enemy => enemy.update());
    enemies = enemies.filter(enemy => !enemy.isOffScreen());

    // 更新粒子
    particles.forEach(particle => particle.update());
    particles = particles.filter(particle => !particle.isDead());

    // 更新爆炸
    explosions.forEach(explosion => explosion.update());
    explosions = explosions.filter(explosion => !explosion.isDead());

    // 更新道具
    powerUps.forEach(powerUp => powerUp.update());
    powerUps = powerUps.filter(powerUp => !powerUp.isOffScreen());

    // 碰撞检测 - 玩家子弹 vs 敌人
    bullets.forEach((bullet, bulletIndex) => {
        if (bullet.vy < 0 && !bullet.isEnemyBullet) { // 玩家子弹
            
            enemies.forEach((enemy, enemyIndex) => {
                if (checkCollision(bullet, enemy)) {
                    
                    // 火箭弹范围伤害
                    if (bullet.type === 'rocket') {
                        // 使用Set记录已受伤的敌人，避免重复伤害
                        const damagedEnemies = new Set();

                        // 收集范围内的敌人
                        const targetsToRemove = [];
                        enemies.forEach((nearbyEnemy, nearbyIndex) => {
                            if (damagedEnemies.has(nearbyEnemy)) return; // 已处理过，跳过

                            const distance = Math.sqrt(
                                Math.pow(nearbyEnemy.x + nearbyEnemy.width/2 - bullet.x, 2) +
                                Math.pow(nearbyEnemy.y + nearbyEnemy.height/2 - bullet.y, 2)
                            );
                            if (distance <= 100) { // 爆炸范围
                                const damage = distance <= 50 ? bullet.damage : bullet.damage * 0.6;
                                nearbyEnemy.takeDamage(damage);
                                damagedEnemies.add(nearbyEnemy);

                                // 检查敌人是否死亡
                                if (nearbyEnemy.isDead()) {
                                    score += nearbyEnemy.points;
                                    explosions.push(new Explosion(nearbyEnemy.x + nearbyEnemy.width/2, nearbyEnemy.y + nearbyEnemy.height/2, nearbyEnemy.width));

                                    // 随机掉落道具
                                    if (Math.random() < 0.25) {
                                        const types = ['health', 'weapon', 'score'];
                                        const type = types[Math.floor(Math.random() * types.length)];
                                        powerUps.push(new PowerUp(nearbyEnemy.x, nearbyEnemy.y, type));
                                    }

                                    targetsToRemove.push(nearbyIndex);
                                }
                            }
                        });

                        // 倒序移除死亡的敌人，避免索引错乱
                        targetsToRemove.sort((a, b) => b - a).forEach(index => {
                            enemies.splice(index, 1);
                        });

                        // 创建爆炸效果
                        explosions.push(new Explosion(bullet.x, bullet.y, 60));
                        // 新增：火箭弹爆炸光环特效
                        explosions.push(new RocketBlastEffect(bullet.x, bullet.y, 80));
                        bullets.splice(bulletIndex, 1);
                        return;
                    }

                    enemy.takeDamage(bullet.damage);
                    

                    // 吸血系统触发检查
        if (playerUpgrades.levelBased.vampire > 0) {
                        const config = UPGRADE_CONFIG.vampire;
                        const vampireLevel = playerUpgrades.levelBased.vampire;

                        // 计算吸血概率和回血量
                        const healProbability = config.baseProbability + (vampireLevel - 1) * config.probabilityPerLevel;
                        const healAmount = config.baseHeal + (vampireLevel - 1) * config.healPerLevel;

                        // 使用正常概率（不再是测试阶段）
                        if (Math.random() < healProbability) {
                            // 触发吸血
                            const actualHeal = Math.min(healAmount, player.maxHealth - player.health);
                            if (actualHeal > 0) {
                                player.health += actualHeal;
                                console.log(`吸血触发！回血 ${actualHeal} 点，当前血量: ${player.health}`);

                                // 吸血视觉效果 - 绿色跳字
                                createHealText(player.x + player.width/2, player.y, actualHeal);

                                // 吸血粒子特效
                                for(let i = 0; i < 12; i++) {
                                    particles.push(new Particle(
                                        player.x + player.width/2 + (Math.random() - 0.5) * player.width * 0.7,
                                        player.y + player.height/2 + (Math.random() - 0.5) * player.height * 0.7,
                                        (Math.random() - 0.5) * 6,
                                        -Math.random() * 4 - 1,
                                        '#00ff00',
                                        38
                                    ));
        }
        }
        }
    }

                    // 激光可以穿透，其他子弹击中后消失
                    if (bullet.type !== 'laser') {
                        bullets.splice(bulletIndex, 1);
                    }

                    if (enemy.isDead()) {
                        
                        
                        explosions.push(new Explosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.width));

                        // 检查是否是最终Boss
                        if (enemy.type === 'finalBoss') {
    
                                enemy.state=BOSS_STATES.DEFEATED;
                        }                    
                        else
                        {
                        enemies.splice(enemyIndex, 1);
                        score += enemy.points;
                    }

                        // 随机掉落道具
                        if (Math.random() < 0.25) {
                            const types = ['health', 'weapon', 'score'];
                            const type = types[Math.floor(Math.random() * types.length)];
                            powerUps.push(new PowerUp(enemy.x, enemy.y, type));
        }
}
                }
            });

            // // 激光击中3个敌人后也会消失
            // if (bullet.type === 'laser' && hitCount >= 3) {
            //     bullets.splice(bulletIndex, 1);
            // }
        }
    });

    // 内存优化：限制粒子数量
    if (particles.length > 200) {
        particles.splice(0, particles.length - 200);
    }

    // Boss战性能优化：限制Boss子弹数量
    const bossBulletCount = bullets.filter(b => b.vy > 0 && (b.color === '#ff0080' || b.color === '#ff4040')).length;
    if (bossBulletCount > 50) {
        // 移除最早的Boss子弹
        const firstBossIndex = bullets.findIndex(b => b.vy > 0 && (b.color === '#ff0080' || b.color === '#ff4040'));
        if (firstBossIndex !== -1) bullets.splice(firstBossIndex, 1);
    }

    // 碰撞检测 - 敌人子弹 vs 玩家
    bullets.forEach((bullet, bulletIndex) => {
        if (bullet.vy > 0 && checkCollision(bullet, player)) { // 敌人子弹
            // 根据子弹来源确定伤害
            let damage = 10; // 基础敌人伤害降低
            if (bullet.enemyType === 'fast') {
                damage = 12; // 快速敌人伤害
            } else if (bullet.enemyType === 'heavy') {
                damage = 18; // 重型敌人伤害
            } else if (bullet.enemyType === 'boss') {
                damage = 25; // Boss伤害
            }

            player.takeDamage(damage);
            bullets.splice(bulletIndex, 1);
        }
    });

    // 碰撞检测 - 敌人 vs 玩家
    enemies.forEach((enemy, enemyIndex) => {
        if (checkCollision(enemy, player)) {
            // 根据敌人类型确定撞击伤害
            let damage = 15; // 基础敌人撞击伤害
            if (enemy.type === 'fast') {
                damage = 18; // 快速敌人撞击伤害
            } else if (enemy.type === 'heavy') {
                damage = 30; // 重型敌人撞击伤害
            } else if (enemy.type === 'boss') {
                damage = 40; // Boss撞击伤害
            }

            player.takeDamage(damage);
            explosions.push(new Explosion(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.width));
            enemies.splice(enemyIndex, 1);
        }
    });

    // 碰撞检测 - 道具 vs 玩家
    powerUps.forEach((powerUp, powerUpIndex) => {
        if (checkCollision(powerUp, player)) {
            audioManager.playSound('powerup');
            switch(powerUp.type) {
                case 'health':
                    player.health = Math.min(player.maxHealth, player.health + 50); // 测试阶段：增加恢复量 (正式版改为30)
                    break;
                case 'weapon':
                    // 随机给予一种特殊武器的弹药
                    const specialWeapons = ['rocket', 'laser', 'spread'];
                    const randomWeapon = specialWeapons[Math.floor(Math.random() * specialWeapons.length)];
                    const weapon = weapons[randomWeapon];

                    // 给予该武器50%的最大弹药量
                    const ammoToAdd = Math.floor(weapon.maxAmmo * 0.5);
                    weapon.ammo = Math.min(weapon.maxAmmo, weapon.ammo + ammoToAdd);

                    // 不自动切换武器，保持当前武器
                    break;
                case 'score':
                    score += 100;
                    break;
            }
            powerUps.splice(powerUpIndex, 1);
        }
    });

    // 生成敌人和道具
    spawnEnemies();
    spawnPowerUps();

    // 检查游戏结束
    if (player.health <= 0) {
        // 尝试自动复活
        if (revivePlayer()) {
            // 复活成功，继续游戏
            console.log('Player auto-revived!');
    } else {
            // 没有复活道具，游戏结束
            gameState = 'gameOver';
            document.getElementById('finalScore').textContent = score;
            const highScore = localStorage.getItem('highScore') || 0;
            if (score > highScore) {
                localStorage.setItem('highScore', score);
    }
            document.getElementById('highScore').textContent = Math.max(score, highScore);
            document.getElementById('gameOver').style.display = 'block';
}
}

    // 升级系统 - 递增难度
    if (score >= nextLevelScore && upgradePoints < maxUpgrades) {
        gameState = 'upgrading';
        upgradePoints++;
        nextLevelScore += Math.floor(nextLevelScore * levelMultiplier);
        level++;
        gameSpeed = Math.min(2.5, 1 + level * 0.15);
        showUpgradeScreen();
    }
    // 更新UI
updateUI();
            }

// 渲染游戏
function render() {
    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'playing' || gameState === 'paused' || gameState === 'reviving') {
        // 绘制星空背景
        drawStarfield();

        // 绘制游戏对象
        player.draw();
        bullets.forEach(bullet => bullet.draw());
        enemies.forEach(enemy => enemy.draw());
        particles.forEach(particle => particle.draw());
        explosions.forEach(explosion => explosion.draw());
        powerUps.forEach(powerUp => powerUp.draw());

        // 绘制特效
        drawSpecialEffects();

        // 暂停时的覆盖层
        if (gameState === 'paused') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 复活时的特殊效果
        if (gameState === 'reviving') {
            ctx.fillStyle = 'rgba(0, 255, 128, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 复活提示文字
            ctx.save();
            ctx.fillStyle = '#00ff80';
            ctx.font = 'bold 36px Arial';
            ctx.textAlign = 'center';
            ctx.shadowColor = '#00ff80';
            ctx.shadowBlur = 20;
            ctx.fillText('复活中...', canvas.width / 2, canvas.height / 2);
            ctx.restore();
        }
    }
}

// 星空背景 - 增强
let stars = [];
function initStarfield() {
    for(let i = 0; i < 150; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            speed: Math.random() * 3 + 1,
            size: Math.random() * 3,
            brightness: Math.random()
});
    }
}

function drawStarfield() {
    stars.forEach(star => {
        ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = -star.size;
            star.x = Math.random() * canvas.width;
        }
});
}

// 更新UI
function updateUI() {
    // 更新血条
    const healthPercent = Math.max(0, player.health) / player.maxHealth * 100;
    document.getElementById('health').textContent = Math.max(0, player.health);
    document.getElementById('healthBar').style.width = healthPercent + '%';

    // 血条保持绿色
    const healthBar = document.getElementById('healthBar');
    healthBar.style.background = 'linear-gradient(90deg, #00ff00, #80ff00)';

    // 更新护盾条
    const shieldDisplay = document.getElementById('shieldDisplay');
    if (playerUpgrades.levelBased.shield > 0) {
        const config = UPGRADE_CONFIG.shield;
        const shieldLevel = playerUpgrades.levelBased.shield;
        const maxShield = config.baseShield + (shieldLevel - 1) * config.shieldPerLevel;

        shieldDisplay.style.display = 'block';
        document.getElementById('shieldValue').textContent = Math.max(0, playerState.shieldValue);
        document.getElementById('maxShieldValue').textContent = maxShield;

        const shieldPercent = playerState.shieldActive ? (playerState.shieldValue / maxShield * 100) : 0;
        document.getElementById('shieldBar').style.width = shieldPercent + '%';

        // 护盾条颜色变化
        const shieldBar = document.getElementById('shieldBar');
        if (shieldPercent > 60) {
            shieldBar.style.background = 'linear-gradient(90deg, #00ffff, #80ffff)';
        } else if (shieldPercent > 30) {
            shieldBar.style.background = 'linear-gradient(90deg, #40ffff, #00cccc)';
        } else if (shieldPercent > 0) {
            shieldBar.style.background = 'linear-gradient(90deg, #0080ff, #004080)';
        }
    } else {
        shieldDisplay.style.display = 'none';
    }

    document.getElementById('score').textContent = score;
    document.getElementById('nextLevel').textContent = nextLevelScore;
    document.getElementById('level').textContent = level;
    document.getElementById('currentWeaponName').textContent = weapons[currentWeapon].name;

    // 更新武器槽显示
        const weaponKeys = Object.keys(weapons);
    weaponKeys.forEach((weaponKey, index) => {
        const slot = document.getElementById(`weapon-slot-${index}`);
        const weapon = weapons[weaponKey];

        if (weaponKey === currentWeapon) {
            // 当前选中的武器
            slot.style.border = '2px solid #00ffff';
            slot.style.opacity = '1';
            slot.style.boxShadow = '0 0 10px #00ffff';
        } else if (weapon.ammo > 0 || weapon.ammo === -1) {
            // 有弹药的武器
            slot.style.border = '2px solid #888';
            slot.style.opacity = '0.8';
            slot.style.boxShadow = 'none';
        } else {
            // 没有弹药的武器
            slot.style.border = '2px solid #444';
            slot.style.opacity = '0.3';
            slot.style.boxShadow = 'none';
        }
    });

    // 更新弹药数量显示
    document.getElementById('rocket-ammo').textContent = weapons.rocket.ammo;
    document.getElementById('laser-ammo').textContent = weapons.laser.ammo;
    document.getElementById('spread-ammo').textContent = weapons.spread.ammo;

    // 更新升级属性显示
    document.getElementById('damageLevel').textContent = playerUpgrades.levelBased.damage;
    document.getElementById('fireRateLevel').textContent = playerUpgrades.levelBased.fireRate;
    document.getElementById('speedLevel').textContent = playerUpgrades.levelBased.speed;

    // 更新右侧属性栏
    updateRightPanel();

    // 更新炸弹和复活道具快捷键提示
    const bombHint = document.getElementById('bombHint');
    if (bombHint) {
        if (playerUpgrades.countBased.bomb > 0) {
            bombHint.style.display = 'inline';
        } else {
            bombHint.style.display = 'none';
        }
    }
    const reviveHint = document.getElementById('reviveHint');
    if (reviveHint) {
        if (playerUpgrades.countBased.revive > 0) {
            reviveHint.style.display = 'inline';
        } else {
            reviveHint.style.display = 'none';
        }
    }
}



// 更新右侧属性栏
function updateRightPanel() {
    let rightPanel = document.getElementById('rightPanel');
    if (!rightPanel) {
        rightPanel = createRightSidePanel();
    }

    // 清空现有内容
    rightPanel.innerHTML = '';

    // 等级强化区域（有等级限制的升级）
    if (playerUpgrades.levelBased.damage > 0 || playerUpgrades.levelBased.fireRate > 0 || playerUpgrades.levelBased.speed > 0 || playerUpgrades.levelBased.vampire > 0 || playerUpgrades.levelBased.shield > 0 || playerUpgrades.levelBased.ghost > 0) {
        const levelTitle = document.createElement('div');
        levelTitle.style.cssText = `
            color: #00ffff;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 10px;
            text-align: center;
        `;
        levelTitle.textContent = '等级强化';
        rightPanel.appendChild(levelTitle);

        // 基础属性强化
        if (playerUpgrades.levelBased.damage > 0) {
            const damageBox = createAttributeBox('火力强化', `Lv.${playerUpgrades.levelBased.damage}`, '#ff4040');
            rightPanel.appendChild(damageBox.box);
        }

        if (playerUpgrades.levelBased.fireRate > 0) {
            const fireRateBox = createAttributeBox('射速强化', `Lv.${playerUpgrades.levelBased.fireRate}`, '#ffff40');
            rightPanel.appendChild(fireRateBox.box);
        }

        if (playerUpgrades.levelBased.speed > 0) {
            const speedBox = createAttributeBox('机动强化', `Lv.${playerUpgrades.levelBased.speed}`, '#40ff40');
            rightPanel.appendChild(speedBox.box);
        }

        // 特殊技能
        if (playerUpgrades.levelBased.vampire > 0) {
            const vampireBox = createAttributeBox('吸血', `Lv.${playerUpgrades.levelBased.vampire}`, '#ff4080');
            rightPanel.appendChild(vampireBox.box);
        }

        if (playerUpgrades.levelBased.shield > 0) {
            const shieldBox = createAttributeBox('护盾', `Lv.${playerUpgrades.levelBased.shield}`, '#40ffff');
            rightPanel.appendChild(shieldBox.box);
        }

        if (playerUpgrades.levelBased.ghost > 0) {
            const ghostBox = createAttributeBox('幽灵', 'Lv.1', '#8040ff');
            rightPanel.appendChild(ghostBox.box);
        }
    }

    // 道具数量区域（按数量累积的道具）
    if (playerUpgrades.countBased.bomb > 0 || playerUpgrades.countBased.revive > 0) {
        const itemTitle = document.createElement('div');
        itemTitle.style.cssText = `
            color: #ff8040;
            font-weight: bold;
            font-size: 16px;
            margin: 15px 0 10px 0;
            text-align: center;
        `;
        itemTitle.textContent = '道具数量';
        rightPanel.appendChild(itemTitle);

        if (playerUpgrades.countBased.bomb > 0) {
            const bombBox = createAttributeBox('清屏炸弹', `x${playerUpgrades.countBased.bomb}`, '#ffff40');
            rightPanel.appendChild(bombBox.box);
        }

        if (playerUpgrades.countBased.revive > 0) {
            const reviveBox = createAttributeBox('复活', `x${playerUpgrades.countBased.revive}`, '#40ff80');
            rightPanel.appendChild(reviveBox.box);
        }
    }

    // 如果没有任何升级，显示提示
    if (
        playerUpgrades.levelBased.damage === 0 &&
        playerUpgrades.levelBased.fireRate === 0 &&
        playerUpgrades.levelBased.speed === 0 &&
        playerUpgrades.levelBased.vampire === 0 &&
        playerUpgrades.levelBased.shield === 0 &&
        playerUpgrades.countBased.bomb === 0 &&
        playerUpgrades.countBased.revive === 0 &&
        playerUpgrades.levelBased.ghost === 0
    ) {
        const noUpgradeBox = createAttributeBox('升级状态', '暂无升级', '#888888');
        rightPanel.appendChild(noUpgradeBox.box);
    }
}

// 创建右侧属性栏显示区域
function createRightSidePanel() {
    // 移除旧的升级信息显示
    const oldUpgradeInfo = document.getElementById('upgradeInfo');
    if (oldUpgradeInfo) {
        oldUpgradeInfo.remove();
    }

    const rightPanel = document.createElement('div');
    rightPanel.id = 'rightPanel';
    rightPanel.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        width: 200px;
        color: #ffffff;
        font-size: 14px;
        font-family: Arial, sans-serif;
        z-index: 10;
        display: none;
    `;
    document.body.appendChild(rightPanel);
    return rightPanel;
}

// 创建单个属性框
function createAttributeBox(title, value, color = '#00ffff') {
    const box = document.createElement('div');
    box.style.cssText = `
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid ${color};
        border-radius: 8px;
        padding: 8px 12px;
        margin-bottom: 8px;
        box-shadow: 0 0 10px rgba(0, 255, 255, 0.3);
    `;

    const titleDiv = document.createElement('div');
    titleDiv.style.cssText = `
        font-weight: bold;
        color: ${color};
        margin-bottom: 4px;
    `;
    titleDiv.textContent = title;

    const valueDiv = document.createElement('div');
    valueDiv.style.cssText = `
        color: #ffffff;
        font-size: 13px;
    `;
    valueDiv.textContent = value;

    box.appendChild(titleDiv);
    box.appendChild(valueDiv);

    return { box, valueDiv };
}


// 显示升级界面 - 二选一版本
function showUpgradeScreen() {
    const upgradeOptions = generateUpgradeOptions();

    // 清空现有选项
    const upgradeContainer = document.getElementById('upgradeOptions');
    if (upgradeContainer) {
        upgradeContainer.innerHTML = '';

        // 检查是否有可用选项
        if (upgradeOptions.length === 0) {
            // 全部升级满了，显示提示和跳过按钮
            const message = document.createElement('div');
            message.style.cssText = `
                color: #ffffff;
                font-size: 18px;
                text-align: center;
                margin: 20px 0;
            `;
            message.textContent = '所有升级已满级！';
            upgradeContainer.appendChild(message);

            const skipButton = document.createElement('button');
            skipButton.className = 'upgrade-option';
            skipButton.textContent = '跳过升级';
            skipButton.onclick = () => {
    document.getElementById('upgradeScreen').style.display = 'none';
        gameState = 'playing';
    };
            upgradeContainer.appendChild(skipButton);
        } else {
            // 生成升级选项按钮
            upgradeOptions.forEach((upgradeType, index) => {
                const config = UPGRADE_CONFIG[upgradeType];
                let currentLevel = 0;
                if (playerUpgrades.levelBased.hasOwnProperty(upgradeType)) {
                    currentLevel = playerUpgrades.levelBased[upgradeType];
                } else if (playerUpgrades.countBased.hasOwnProperty(upgradeType)) {
                    currentLevel = playerUpgrades.countBased[upgradeType];
                }

                const button = document.createElement('button');
                button.className = 'upgrade-option';
                button.onclick = () => selectUpgrade(upgradeType);

                // 根据升级类型显示不同信息
                let displayText = '';
                if (config.maxLevel) {
                    // 属性加成：显示等级
                    displayText = `${config.name} Lv.${currentLevel + 1}\n${config.description}`;
                } else {
                    // 道具系统：显示获得数量
                    if (upgradeType === 'bomb' || upgradeType === 'revive') {
                        displayText = `${config.name} +${config.countPerPickup}\n${config.description}`;
                    } else {
                        displayText = `${config.name} Lv.${currentLevel + 1}\n${config.description}`;
}
                }

                button.textContent = displayText;
                upgradeContainer.appendChild(button);
            });
        }
    }
    document.getElementById('upgradeScreen').style.display = 'block';
}

// 选择升级 - 扩展版本
function selectUpgrade(upgradeType) {
    const config = UPGRADE_CONFIG[upgradeType];

    switch(upgradeType) {
        case 'damage':
            playerUpgrades.levelBased.damage++;
            // 增加所有武器伤害
            Object.keys(weapons).forEach(key => {
                weapons[key].damage = Math.floor(weapons[key].damage * (1 + config.increment));
            });
            break;

        case 'speed':
            playerUpgrades.levelBased.speed++;
            // 增加移动速度
            player.maxSpeed = Math.min(10, player.maxSpeed * (1 + config.increment));
            break;

        case 'fireRate':
            playerUpgrades.levelBased.fireRate++;
            // 减少射击冷却时间
            Object.keys(weapons).forEach(key => {
                weapons[key].cooldown = Math.max(20, Math.floor(weapons[key].cooldown * (1 - config.increment)));
            });
            break;

        case 'vampire':
            playerUpgrades.levelBased.vampire++;
            break;

        case 'shield':
            playerUpgrades.levelBased.shield++;
            break;

        case 'bomb':
            playerUpgrades.countBased.bomb += config.countPerPickup;
            break;

        case 'revive':
            playerUpgrades.countBased.revive += config.countPerPickup;
            break;

        case 'ghost':
            playerUpgrades.levelBased.ghost++;
            break;
    }

    // 隐藏升级界面，继续游戏
    document.getElementById('upgradeScreen').style.display = 'none';
    gameState = 'playing';
    updateUI();

    // 立即自动保存游戏进度
    saveGameState();
}

// 生成升级选项 - 二选一系统
function generateUpgradeOptions() {
    const availableUpgrades = [];

    // 检查哪些升级选项可用
    Object.keys(UPGRADE_CONFIG).forEach(upgradeType => {
        const config = UPGRADE_CONFIG[upgradeType];
        let currentLevel = 0;
        if (playerUpgrades.levelBased.hasOwnProperty(upgradeType)) {
            currentLevel = playerUpgrades.levelBased[upgradeType];
        } else if (playerUpgrades.countBased.hasOwnProperty(upgradeType)) {
            currentLevel = playerUpgrades.countBased[upgradeType];
        }

        // 检查是否达到最大等级（所有道具都有maxLevel限制）
        if (config.maxLevel && currentLevel >= config.maxLevel) {
            console.log(`${upgradeType} 已满级: ${currentLevel}/${config.maxLevel}`);
            return; // 已满级，跳过
        }

        // 添加到可用选项池，根据权重添加多次
        const weight = UPGRADE_POOL_WEIGHTS[upgradeType] || 25;
        for (let i = 0; i < weight; i++) {
            availableUpgrades.push(upgradeType);
        }
        console.log(`${upgradeType} 添加到选项池，权重: ${weight}, 当前等级: ${currentLevel}`);
    });

    console.log('可用升级选项池:', availableUpgrades);
    console.log('升级配置:', UPGRADE_CONFIG);
    console.log('当前升级状态:', playerUpgrades);

    // 如果没有可用选项，返回空数组
    if (availableUpgrades.length === 0) {
        console.log('没有可用升级选项');
        return [];
    }

    // 如果只有一个选项类型，返回该选项
    const uniqueOptions = [...new Set(availableUpgrades)];
    if (uniqueOptions.length === 1) {
        console.log('只有一个升级选项:', uniqueOptions[0]);
        return [uniqueOptions[0]];
    }

    // 随机选择2个不同的选项
    const selectedOptions = [];
    while (selectedOptions.length < 2 && selectedOptions.length < uniqueOptions.length) {
        const randomIndex = Math.floor(Math.random() * availableUpgrades.length);
        const option = availableUpgrades[randomIndex];

        // 确保不重复选择同一个升级类型
        if (!selectedOptions.includes(option)) {
            selectedOptions.push(option);
        }
    }

    console.log('最终选择的升级选项:', selectedOptions);
    return selectedOptions;
}

// 游戏循环 - 高频率更新
let lastTime = 0;
const targetFPS = 120; // 目标120FPS
const frameTime = 1000 / targetFPS;

function gameLoop(currentTime) {
    const deltaTime = currentTime - lastTime;

    if (deltaTime >= frameTime) {
        update();
        render();
        lastTime = currentTime;
    }

    requestAnimationFrame(gameLoop);
}

// 事件监听
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;

    // 武器切换
    if (e.key >= '1' && e.key <= '4') {
        const weaponKeys = Object.keys(weapons);
        const index = parseInt(e.key) - 1;
        if (index < weaponKeys.length) {
            const targetWeapon = weaponKeys[index];
            // 只能切换到有弹药的武器（普通子弹总是可用）
            if (weapons[targetWeapon].ammo !== 0) {
                currentWeapon = targetWeapon;
updateUI();
            }
        }
    }

    // 使用清屏炸弹
    if ((e.key === 'x' || e.key === 'X') && gameState === 'playing') {
        useBomb();
    }

    // ESC键暂停
    if (e.key === 'Escape' && gameState === 'playing') {
        togglePause();
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

// 游戏控制函数
function startGame() {
    // 启用音频（需要用户交互）
    audioManager.enableAudio();

    gameState = 'playing';
    // 隐藏开始界面，显示游戏UI
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('upgradeScreen').style.display = 'none';

    // 显示游戏UI
    document.getElementById('ui').style.display = 'block';

    // 显示右侧属性栏
    const rightPanel = document.getElementById('rightPanel');
    if (rightPanel) {
        rightPanel.style.display = 'block';
    }

    // 重置游戏状态
    score = 0;
    level = 1;
    gameSpeed = 1;
    player.health = player.maxHealth;
    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
    player.maxSpeed = 6;
    player.invulnerable = 0;
    player.velocity = { x: 0, y: 0 }; // 重置速度状态

    // 清空数组
    bullets = [];
    enemies = [];
    particles = [];
    powerUps = [];
    explosions = [];

    // 重置升级系统
    upgradePoints = 0;
    nextLevelScore = 30;
    playerUpgrades = {
        levelBased: {
            damage: 0,
            fireRate: 0,
            speed: 0,
            vampire: 0,
            shield: 0,
            ghost: 0
        },
        countBased: {
            bomb: 0,
            revive: 0
        }
    };



    // 重置玩家状态
    playerState = {
        lastDamageTime: 0,
        shieldActive: false,
        shieldValue: 0,
        isReviving: false
    };


    // 重置武器系统
    currentWeapon = 'normal';
    weapons.normal = { name: '普通子弹', damage: 12, speed: 9, cooldown: 300, color: '#00ffff', ammo: -1, maxAmmo: -1, description: '无限弹药，稳定可靠' };
    weapons.rocket = { name: '火箭弹', damage: 50, speed: 8, cooldown: 800, color: '#ff8800', ammo: 0, maxAmmo: 20, description: '范围爆炸，威力巨大' };
    weapons.laser = { name: '激光炮', damage: 35, speed: 10, cooldown: 300, color: '#ff0080', ammo: 0, maxAmmo: 100, description: '超高伤害，穿透敌人' };
    weapons.spread = { name: '散弹枪', damage: 20, speed: 8, cooldown: 350, color: '#00ff80', ammo: 0, maxAmmo: 160, description: '范围攻击，多发弹丸' };

    updateUI();

    console.log('Game started');
}

function restartGame() {
    startGame();
}

// 暂停和菜单功能
function togglePause() {
    // 启用音频（需要用户交互）
    audioManager.enableAudio();

    if (gameState === 'playing') {
        gameState = 'paused';
        document.getElementById('pauseScreen').style.display = 'block';
        console.log('Game paused');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        document.getElementById('pauseScreen').style.display = 'none';
        console.log('Game resumed');
    }
}

function goToMenu() {
    console.log('Going to menu');
    gameState = 'start';

    // 隐藏所有界面，显示开始界面
    document.getElementById('startScreen').style.display = 'block';
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('upgradeScreen').style.display = 'none';

    // 隐藏游戏UI
    document.getElementById('ui').style.display = 'none';

    // 隐藏右侧属性栏
    const rightPanel = document.getElementById('rightPanel');
    if (rightPanel) {
        rightPanel.style.display = 'none';
    }

    // 重置游戏状态
    resetGameState();
}

function resetGameState() {
    // 清空所有游戏对象
    bullets = [];
    enemies = [];
    particles = [];
    powerUps = [];
    explosions = [];

    // 重置玩家状态
    player.x = canvas.width / 2;
    player.y = canvas.height - 100;
    player.health = player.maxHealth;
    player.maxSpeed = 6; // 重置移动速度
    player.invulnerable = 0;
    player.velocity = { x: 0, y: 0 }; // 重置速度状态

    // 重置游戏变量
    score = 0;
    level = 1;
    gameSpeed = 1;
    currentWeapon = 'normal';

    // 重置升级系统
    upgradePoints = 0;
    nextLevelScore = 30;
    playerUpgrades = {
        levelBased: {
            damage: 0,
            fireRate: 0,
            speed: 0,
            vampire: 0,
            shield: 0,
            ghost: 0
        },
        countBased: {
            bomb: 0,
            revive: 0
        }
    };


    // 重置玩家状态
    playerState = {
        lastDamageTime: 0,
        shieldActive: false,
        shieldValue: 0,
        isReviving: false
    };


    // 重置武器属性
    weapons.normal = { name: '普通子弹', damage: 12, speed: 9, cooldown: 300, color: '#00ffff', ammo: -1, maxAmmo: -1, description: '无限弹药，稳定可靠' };
    weapons.rocket = { name: '火箭弹', damage: 80, speed: 8, cooldown: 800, color: '#ff8800', ammo: 0, maxAmmo: 20, description: '范围爆炸，威力巨大' };
    weapons.laser = { name: '激光炮', damage: 35, speed: 10, cooldown: 300, color: '#ff0080', ammo: 0, maxAmmo: 100, description: '超高伤害，穿透敌人' };
    weapons.spread = { name: '散弹枪', damage: 20, speed: 8, cooldown: 350, color: '#00ff80', ammo: 0, maxAmmo: 160, description: '范围攻击，多发弹丸' };
    updateUI();
}

function saveGameState() {
    try {
        const saveData = {
            score,
            level,
            gameSpeed,
            upgradePoints,
            nextLevelScore,
            playerUpgrades,
            playerState,
            weapons: {
                rocket: { ...weapons.rocket },
                laser: { ...weapons.laser },
                spread: { ...weapons.spread }
            },
            currentWeapon,
            player: {
                x: player.x,
                y: player.y,
                health: player.health,
                maxHealth: player.maxHealth,
                maxSpeed: player.maxSpeed,
                invulnerable: player.invulnerable,
                velocity: { ...player.velocity }
            }
        };
        localStorage.setItem('spaceShooterSave', JSON.stringify(saveData));
        //console.log('Game saved');
    } catch (e) {
        console.warn('Failed to save game:', e);
    }
}

function loadGameState() {
    try {
        const saveData = JSON.parse(localStorage.getItem('spaceShooterSave'));
        if (!saveData) return false;

        score = saveData.score || 0;
        level = saveData.level || 1;
        gameSpeed = saveData.gameSpeed || 1;
        upgradePoints = saveData.upgradePoints || 0;
        nextLevelScore = saveData.nextLevelScore || 50;
        playerUpgrades = saveData.playerUpgrades || playerUpgrades;
        playerState = saveData.playerState || playerState;

        // 恢复武器弹药
        if (saveData.weapons) {
            if (saveData.weapons.rocket) Object.assign(weapons.rocket, saveData.weapons.rocket);
            if (saveData.weapons.laser) Object.assign(weapons.laser, saveData.weapons.laser);
            if (saveData.weapons.spread) Object.assign(weapons.spread, saveData.weapons.spread);
        }

        currentWeapon = saveData.currentWeapon || 'normal';

        // 恢复玩家状态
        if (saveData.player) {
            player.x = saveData.player.x;
            player.y = saveData.player.y;
            player.health = saveData.player.health;
            player.maxHealth = saveData.player.maxHealth;
            player.maxSpeed = saveData.player.maxSpeed;
            player.invulnerable = saveData.player.invulnerable;
            player.velocity = { ...saveData.player.velocity };
        }

        updateUI();
        //console.log('Game loaded');
        return true;
    } catch (e) {
        console.warn('Failed to load game:', e);
        return false;
    }
}

// 初始化
initStarfield();
if (!loadGameState()) {
    updateUI();
}

// 确保开始界面状态下UI被隐藏
if (gameState === 'start') {
    const uiElement = document.getElementById('ui');
    if (uiElement) {
        uiElement.style.display = 'none';
    }
    const rightPanel = document.getElementById('rightPanel');
    if (rightPanel) {
        rightPanel.style.display = 'none';
    }
}
gameLoop();

// 自动保存：每30秒保存一次
setInterval(() => {
    if (gameState === 'playing' || gameState === 'upgrading') {
        saveGameState();
    }
}, 30000);

// 页面关闭/刷新时自动保存
window.addEventListener('beforeunload', () => {
    if (gameState === 'playing' || gameState === 'upgrading') {
        saveGameState();
    }
});

// 特效绘制函数
function drawSpecialEffects() {
    // 绘制瞄准线
    if (window.aimingLines) {
        window.aimingLines.forEach((line, index) => {
            if (line.life > 0) {
                ctx.save();

                // 改进瞄准线视觉效果
                const alpha = line.life / line.maxLife;
                const pulseIntensity = Math.sin(line.life * 0.4) * 0.3 + 0.7;

                // 外层红色警告线
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 4;
                ctx.globalAlpha = alpha * pulseIntensity;
                ctx.setLineDash([10, 5]);
                ctx.beginPath();
                ctx.moveTo(line.startX, line.startY);
                ctx.lineTo(line.endX, line.endY);
                ctx.stroke();

                // 内层亮白色核心线
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.globalAlpha = alpha * pulseIntensity * 0.8;
                ctx.setLineDash([5, 3]);
                ctx.beginPath();
                ctx.moveTo(line.startX, line.startY);
                ctx.lineTo(line.endX, line.endY);
                ctx.stroke();

                // 起点发光效果
                ctx.fillStyle = '#ff0000';
                ctx.globalAlpha = alpha * pulseIntensity;
                ctx.shadowColor = '#ff0000';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(line.startX, line.startY, 4, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();

                line.life--;
            } else {
                window.aimingLines.splice(index, 1);
            }
        });
    }

    // 绘制警告（激光警告区域或冲撞警告线）
    if (window.chargeWarnings) {
        window.chargeWarnings.forEach((warning, index) => {
            if (warning.life > 0) {
                ctx.save();

                if (warning.type === 'laser') {
                    // 激光警告区域
                    const alpha = Math.sin(warning.life * 0.4) * 0.4 + 0.3;
                    const progress = 1 - (warning.life / warning.maxLife);

                    // 警告区域填充
                    ctx.fillStyle = warning.color;
                    ctx.globalAlpha = alpha * 0.3;
                    ctx.fillRect(
                        warning.centerX - warning.width/2,
                        warning.centerY - warning.height/2,
                        warning.width,
                        warning.height
                    );

                    // 警告区域边框
                    ctx.strokeStyle = warning.color;
                    ctx.lineWidth = 3 + progress * 3;
                    ctx.globalAlpha = alpha;
                    ctx.strokeRect(
                        warning.centerX - warning.width/2,
                        warning.centerY - warning.height/2,
                        warning.width,
                        warning.height
                    );

                    // 中心十字标记
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = alpha * 1.5;
                    ctx.beginPath();
                    ctx.moveTo(warning.centerX - 20, warning.centerY);
                    ctx.lineTo(warning.centerX + 20, warning.centerY);
                    ctx.moveTo(warning.centerX, warning.centerY - 20);
                    ctx.lineTo(warning.centerX, warning.centerY + 20);
                    ctx.stroke();

                } else {
                    // 传统冲撞警告线
                    ctx.strokeStyle = warning.color;
                    ctx.lineWidth = 4;
                    ctx.globalAlpha = Math.sin(warning.life * 0.3) * 0.5 + 0.5;
                    ctx.beginPath();
                    ctx.moveTo(warning.startX, warning.startY);
                    ctx.lineTo(warning.endX, warning.endY);
                    ctx.stroke();
                }

                ctx.restore();
                warning.life--;
            } else {
                window.chargeWarnings.splice(index, 1);
            }
        });
    }
}

// Boss警告系统
function showBossAlert() {
    // 创建Boss警告界面
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(255, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
        animation: bossAlert 3s ease-out forwards;
    `;

    const alertText = document.createElement('div');
    alertText.style.cssText = `
        color: white;
        font-size: 48px;
        font-weight: bold;
        text-align: center;
        text-shadow: 0 0 20px #ff0000;
        animation: pulse 0.5s infinite alternate;
    `;
    alertText.textContent = 'WARNING!\nFINAL BOSS APPROACHING!';

    alertDiv.appendChild(alertText);
    document.body.appendChild(alertDiv);

    // 添加CSS动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes bossAlert {
            0% { opacity: 1; }
            70% { opacity: 1; }
            100% { opacity: 0; }
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            100% { transform: scale(1.1); }
        }
    `;
    document.head.appendChild(style);

    // 3秒后移除
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
        if (style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }, 3000);
}

// 游戏胜利系统
function triggerVictory() {
    gameState = 'victory';

    // 计算最终分数
    const gameTime = window.gameTime || 0; // 修复gameTime未定义问题
    const timeBonus = Math.max(0, 10000 - gameTime * 10); // 时间奖励
    const finalScore = score + timeBonus;

    // 显示胜利界面
    showVictoryScreen(finalScore, timeBonus);

    // 保存最高分
    const highScore = localStorage.getItem('highScore') || 0;
    if (finalScore > highScore) {
        localStorage.setItem('highScore', finalScore);
    }
}

// 显示胜利界面
function showVictoryScreen(finalScore, timeBonus) {
    // 隐藏所有界面和UI
    document.getElementById('startScreen').style.display = 'none';
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('pauseScreen').style.display = 'none';
    document.getElementById('upgradeScreen').style.display = 'none';
    document.getElementById('ui').style.display = 'none';
    const rightPanel = document.getElementById('rightPanel');
    if (rightPanel) rightPanel.style.display = 'none';

    // 移除旧的胜利界面
    const oldVictoryScreen = document.getElementById('victoryScreen');
    if (oldVictoryScreen) oldVictoryScreen.remove();

    // 创建全新科幻风胜利界面
    const victoryScreen = document.createElement('div');
    victoryScreen.id = 'victoryScreen';
    victoryScreen.style.cssText = `
        position: fixed;
        top: 0; left: 0; width: 100vw; height: 100vh;
        background: radial-gradient(circle at center, #001122 0%, #000511 60%, #000000 100%);
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        z-index: 2000; color: #fff; text-align: center; font-family: 'Arial', sans-serif;
        overflow: hidden;
        animation: victoryFadeIn 1.2s cubic-bezier(0.4,0,0.2,1);
    `;

    // 动态星空背景
    const starsContainer = document.createElement('div');
    starsContainer.style.cssText = `
        position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1;
    `;
    for (let i = 0; i < 120; i++) {
        const star = document.createElement('div');
        star.style.cssText = `
            position: absolute;
            width: ${Math.random() * 2 + 1}px;
            height: ${Math.random() * 2 + 1}px;
            background: #00ffff;
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            opacity: ${Math.random() * 0.7 + 0.3};
            animation: twinkle ${Math.random() * 3 + 2}s infinite alternate;
        `;
        starsContainer.appendChild(star);
    }
    victoryScreen.appendChild(starsContainer);

    // 内容容器
    const content = document.createElement('div');
    content.style.cssText = `
        background: rgba(0, 0, 0, 0.85);
        border: 2px solid #00ffff;
        border-radius: 20px;
        padding: 60px 80px;
        box-shadow: 0 0 40px #00ffff, 0 0 80px #004466;
        max-width: 600px;
        margin: 0 auto;
        animation: contentSlideIn 1s cubic-bezier(0.4,0,0.2,1);
    `;

    content.innerHTML = `
        <div style="font-size: 64px; font-weight: bold; margin-bottom: 30px; color: #00ffff; text-shadow: 0 0 40px #00ffff, 0 0 20px #fff;">
             MISSION COMPLETE ⭐
        </div>
        <div style="font-size: 28px; margin-bottom: 40px; color: #ffffff; text-shadow: 0 0 10px #00ff00;">
            最终Boss已被击败！银河系重获和平！ 
        </div>
        <div style="background: rgba(0,255,255,0.1); border: 1px solid #00ffff; border-radius: 15px; padding: 30px; margin-bottom: 40px;">
            <div style="font-size: 24px; margin-bottom: 15px; color: #00ff00;">
                🎯 基础分数: <span style="color: #ffffff; font-weight: bold;">${score.toLocaleString()}</span>
            </div>
            <div style="font-size: 24px; margin-bottom: 15px; color: #ffff00;">
                ⏱️ 时间奖励: <span style="color: #ffffff; font-weight: bold;">+${timeBonus.toLocaleString()}</span>
            </div>
            <div style="font-size: 32px; margin-bottom: 10px; color: #ff8000; text-shadow: 0 0 10px #ff8000;">
                🏆 最终分数: <span style="color: #ffffff; font-weight: bold;">${finalScore.toLocaleString()}</span>
            </div>
            <div style="font-size: 20px; color: #00ffff;">
                最高分: <span style="color: #ffff00;">${Math.max(finalScore, localStorage.getItem('highScore') || 0)}</span>
            </div>
        </div>
        <div style="display: flex; gap: 30px; justify-content: center;">
            <button id="victoryRestartBtn" style="
                padding: 18px 40px;
                font-size: 22px;
                background: linear-gradient(45deg, #00ffff, #0080ff);
                color: #000;
                border: none;
                border-radius: 12px;
                cursor: pointer;
                font-weight: bold;
                box-shadow: 0 0 20px #00ffff;
                transition: all 0.2s;
            ">再来一局</button>
            <button id="victoryMenuBtn" style="
                padding: 18px 40px;
                font-size: 22px;
                background: linear-gradient(45deg, #ff8000, #ffaa00);
                color: #000;
                border: none;
                border-radius: 12px;
                cursor: pointer;
                font-weight: bold;
                box-shadow: 0 0 20px #ffaa00;
                transition: all 0.2s;
            ">返回主菜单</button>
        </div>
    `;

    victoryScreen.appendChild(content);

    // 动画
    const style = document.createElement('style');
    style.textContent = `
        @keyframes victoryFadeIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
        }
        @keyframes contentSlideIn {
            0% { transform: translateY(80px) scale(0.95); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes titleGlow {
            0% { text-shadow: 0 0 40px #00ffff, 0 0 20px #fff; }
            100% { text-shadow: 0 0 80px #00ffff, 0 0 40px #fff; }
        }
        @keyframes twinkle {
            0% { opacity: 0.3; }
            100% { opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    // 按钮逻辑
    setTimeout(() => {
        document.getElementById('victoryRestartBtn').onclick = () => {
            victoryScreen.remove();
            restartGame();
        };
        document.getElementById('victoryMenuBtn').onclick = () => {
            victoryScreen.remove();
            goToMenu();
        };
    }, 100);

    document.body.appendChild(victoryScreen);
}

// 导出函数供其他文件使用
window.showBossAlert = showBossAlert;
window.triggerVictory = triggerVictory;
