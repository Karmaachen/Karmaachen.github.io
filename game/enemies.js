// 敌人系统增强版 - enemies.js
// 包含新敌人类型、入场效果、预判射击、最终Boss等

// 游戏状态变量（需要从主文件访问）
let gameTime = 0; // 游戏时间计数器
let bossSpawned = false; // Boss是否已生成
let finalBoss = null; // 最终Boss引用

// Boss触发条件
const BOSS_TRIGGER = {
    level: 8,           // 达到8级触发
    timeMinutes: 3      // 或游戏时间3分钟
};

// 增强的敌人类 - 替换原有Enemy类
class EnhancedEnemy {
    constructor(type = 'basic') {
        this.type = type;
        this.lastShot = 0;
        this.animFrame = 0;
        this.entryComplete = false;
        this.entryProgress = 0;
        
        // 入场路径设置
        this.setupEntryPath();
        
        // 根据类型设置属性
        this.setupEnemyStats(type);
        
        // 预判射击相关
        this.aimOffset = (Math.random() - 0.5) * 100; // 预判偏差
        this.lastPlayerPos = { x: 0, y: 0 };
    }
    
    setupEntryPath() {
        // 随机选择入场方式：70%从正前方，30%从左右
        const rand = Math.random();
        if (rand < 0.7) {
            // 70%概率从正前方进入
            this.entryType = 'top';
        } else {
            // 30%概率从左右进入
            const sideEntries = ['leftDiagonal', 'rightDiagonal', 'spiral'];
            this.entryType = sideEntries[Math.floor(Math.random() * sideEntries.length)];
        }
        
        // 设置移动模式（入场后的移动方式）
        const movementTypes = ['straight', 'zigzag', 'sine', 'spiral'];
        this.movementType = movementTypes[Math.floor(Math.random() * movementTypes.length)];
        this.movementPhase = 0; // 移动相位
        
        switch(this.entryType) {
            case 'top':
                this.startX = Math.random() * (canvas.width - 60);
                this.startY = -60;
                this.targetX = this.startX;
                this.targetY = 100;
                break;
                
            case 'leftDiagonal':
                this.startX = -60;
                this.startY = Math.random() * 200 - 100;
                this.targetX = Math.random() * (canvas.width * 0.3);
                this.targetY = Math.random() * 150 + 50;
                break;
                
            case 'rightDiagonal':
                this.startX = canvas.width + 60;
                this.startY = Math.random() * 200 - 100;
                this.targetX = canvas.width - Math.random() * (canvas.width * 0.3);
                this.targetY = Math.random() * 150 + 50;
                break;
                
            case 'spiral':
                this.startX = canvas.width / 2;
                this.startY = -60;
                this.targetX = canvas.width / 2;
                this.targetY = 120;
                this.spiralAngle = 0;
                break;
        }
        
        this.x = this.startX;
        this.y = this.startY;
    }
    
    setupEnemyStats(type) {
        switch(type) {
            case 'basic':
                this.width = 40;
                this.height = 40;
                this.speed = 2 + Math.random() * 2;
                this.health = 25;
                this.maxHealth = 25;
                this.color = '#ff4040';
                this.shootCooldown = 1500; // 射得慢
                this.shootAccuracy = 0.3; // 射不准
                this.points = 10;
                break;
                
            case 'fast':
                this.width = 35;
                this.height = 35;
                this.speed = 4 + Math.random() * 2;
                this.health = 20;
                this.maxHealth = 20;
                this.color = '#ff8040';
                this.shootCooldown = 1000; // 射速中等
                this.shootAccuracy = 0.5; // 精准度中等
                this.points = 15;
                break;
                
            case 'heavy':
                this.width = 60;
                this.height = 60;
                this.speed = 1 + Math.random();
                this.health = 60;
                this.maxHealth = 60;
                this.color = '#8040ff';
                this.shootCooldown = 2000; // 射得慢但威力大
                this.shootAccuracy = 0.4; // 精准度一般
                this.points = 30;
                break;
                
            case 'sniper':
                this.width = 45;
                this.height = 45;
                this.speed = 0.8; // 降低移速，让狙击手移动更慢
                this.health = 35;
                this.maxHealth = 35;
                this.color = '#ff0040';
                this.shootCooldown = 2500; // 射速很慢
                this.shootAccuracy = 0.85; // 很精准
                this.points = 25;
                this.sniperCharging = false;
                this.chargeTime = 0;
                break;
                
            case 'splitter':
                this.width = 120;  // 体积增大
                this.height = 80;  // 体积增大
                this.speed = 0.6;
                this.health = 200; // 血量增加
                this.maxHealth = 200; // 血量增加
                this.color = '#40ff40';
                this.shootCooldown = 3000; // 很少射击
                this.shootAccuracy = 0.2; // 射不准
                this.points = 50;  // 分数增加
                this.splitCount = 6; // 分裂成6个小敌人（增加）
                break;
                
            case 'boss':
                this.width = 120;
                this.height = 80;
                this.speed = 1.5;
                this.health = 250;
                this.maxHealth = 250;
                this.color = '#ff0080';
                this.shootCooldown = 600;
                this.shootAccuracy = 0.6;
                this.points = 100;
                this.x = canvas.width / 2 - this.width / 2;
                break;
        }
    }
    
    update() {
        this.animFrame++;
        
        // 入场动画
        if (!this.entryComplete) {
            this.updateEntry();
            return;
        }
        
        // 正常移动逻辑
        this.updateMovement();
        
        // 射击逻辑
        if (Date.now() - this.lastShot > this.shootCooldown) {
            this.shoot();
            this.lastShot = Date.now();
        }
        
        // 特殊敌人逻辑
        this.updateSpecialBehavior();
    }
    
    updateEntry() {
        this.entryProgress += 0.02;
        
        if (this.entryProgress >= 1) {
            this.entryComplete = true;
            this.x = this.targetX;
            this.y = this.targetY;
            return;
        }
        
        // 平滑插值入场
        const t = this.easeInOut(this.entryProgress);
        
        switch(this.entryType) {
            case 'top':
            case 'leftDiagonal':
            case 'rightDiagonal':
                this.x = this.startX + (this.targetX - this.startX) * t;
                this.y = this.startY + (this.targetY - this.startY) * t;
                break;
                
            case 'spiral':
                this.spiralAngle += 0.15;
                this.x = this.targetX + Math.cos(this.spiralAngle) * (50 * (1 - t));
                this.y = this.startY + (this.targetY - this.startY) * t;
                break;
        }
    }
    
    updateMovement() {
        if (this.type === 'boss') {
            this.x += Math.sin(Date.now() * 0.003) * 3;
            this.y = Math.min(120, this.y + this.speed);
        } else {
            // 基础向下移动
            this.y += this.speed * gameSpeed;
            
            // 根据移动模式添加额外的移动
            this.movementPhase += 0.05;
            
            switch(this.movementType) {
                case 'straight':
                    // 直线移动，不添加额外移动
                    break;
                    
                case 'zigzag':
                    // 之字形移动
                    this.x += Math.sin(this.movementPhase * 2) * 1.5;
                    break;
                    
                case 'sine':
                    // 正弦波移动
                    this.x += Math.sin(this.movementPhase) * 2;
                    break;
                    
                case 'spiral':
                    // 螺旋移动
                    this.x += Math.cos(this.movementPhase * 1.5) * 1.8;
                    break;
            }
            
            // 快速敌人的额外左右移动（保持原有特性）
            if (this.type === 'fast') {
                this.x += Math.sin(this.y * 0.03) * 1.5; // 减少幅度避免与新移动模式冲突
            }
        }
        
        // 边界检测
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
    }
    
    updateSpecialBehavior() {
        // 狙击手充能逻辑
        if (this.type === 'sniper' && this.sniperCharging) {
            this.chargeTime++;
            if (this.chargeTime >= 60) { // 缩短充能时间到1秒
                this.fireSniperShot();
                this.sniperCharging = false;
                this.chargeTime = 0;
            }
        }
    }
    
    shoot() {
        // 记录玩家位置用于预判
        this.lastPlayerPos.x = player.x + player.width/2;
        this.lastPlayerPos.y = player.y + player.height/2;
        
        switch(this.type) {
            case 'basic':
                this.shootBasic();
                break;
            case 'fast':
                this.shootPredictive();
                break;
            case 'heavy':
                this.shootSpread();
                break;
            case 'sniper':
                this.startSniperCharge();
                break;
            case 'splitter':
                this.shootBasic(); // 分裂敌人射击很少
                break;
            case 'boss':
                this.shootBoss();
                break;
        }
    }
    
    shootBasic() {
        // 基础敌人：直线射击，有偏差
        const offsetX = (Math.random() - 0.5) * 100 * (1 - this.shootAccuracy);
        bullets.push(new EnemyBullet(
            this.x + this.width/2 + offsetX, 
            this.y + this.height, 
            0, 4, this.type
        ));
    }
    
    shootPredictive() {
        // 预判射击：向玩家移动方向射击
        const dx = this.lastPlayerPos.x - (this.x + this.width/2);
        const dy = this.lastPlayerPos.y - (this.y + this.height/2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // 添加预判偏差
            const accuracy = this.shootAccuracy + (Math.random() - 0.5) * 0.3;
            const vx = (dx / distance) * 5 * accuracy;
            const vy = (dy / distance) * 5 * accuracy;
            
            bullets.push(new EnemyBullet(
                this.x + this.width/2, 
                this.y + this.height, 
                vx, vy, this.type
            ));
        }
    }
    
    shootSpread() {
        // 扇形射击
        for(let i = -1; i <= 1; i++) {
            const offsetX = (Math.random() - 0.5) * 50 * (1 - this.shootAccuracy);
            bullets.push(new EnemyBullet(
                this.x + this.width/2, 
                this.y + this.height, 
                i * 2 + offsetX * 0.1, 4, this.type
            ));
        }
    }
    
    startSniperCharge() {
        if (!this.sniperCharging) {
            this.sniperCharging = true;
            this.chargeTime = 0;
            
            // 显示瞄准线预警
            this.showAimingLine();
        }
    }
    
    fireSniperShot() {
        // 高精度射击
        const dx = player.x + player.width/2 - (this.x + this.width/2);
        const dy = player.y + player.height/2 - (this.y + this.height/2);
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const vx = (dx / distance) * 8; // 更快的子弹
            const vy = (dy / distance) * 8;
            
            // 创建特殊的狙击子弹
            bullets.push(new SniperBullet(
                this.x + this.width/2, 
                this.y + this.height, 
                vx, vy
            ));
        }
    }
    
    shootBoss() {
        // Boss多方向射击
        for(let i = -2; i <= 2; i++) {
            bullets.push(new EnemyBullet(
                this.x + this.width/2, 
                this.y + this.height, 
                i * 3, 5, 'boss'
            ));
        }
    }
    
    showAimingLine() {
        // 创建瞄准线特效
        const aimLine = {
            startX: this.x + this.width/2,
            startY: this.y + this.height,
            endX: player.x + player.width/2,
            endY: player.y + player.height/2,
            life: 60, // 缩短瞄准线持续时间到1秒
            maxLife: 60
        };
        
        // 添加到特效数组（需要在主文件中处理）
        if (window.aimingLines) {
            window.aimingLines.push(aimLine);
        }
    }
    
    takeDamage(damage) {
        this.health -= damage;
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
        
        // 分裂敌人死亡时分裂
        if (this.type === 'splitter' && this.health <= 0) {
            this.splitIntoSmaller();
        }
    }
    
    splitIntoSmaller() {
        // 分裂成小敌人
        for(let i = 0; i < this.splitCount; i++) {
            const angle = (i / this.splitCount) * Math.PI * 2;
            const smallEnemy = new SmallEnemy(
                this.x + Math.cos(angle) * 30,
                this.y + Math.sin(angle) * 30,
                Math.cos(angle) * 3,
                Math.sin(angle) * 3
            );
            enemies.push(smallEnemy);
        }
    }
    
    draw() {
        ctx.save();
        
        // 入场时的透明度效果
        if (!this.entryComplete) {
            ctx.globalAlpha = this.entryProgress;
        }
        
        // 狙击手充能时的红色闪烁
        if (this.type === 'sniper' && this.sniperCharging) {
            const flashIntensity = Math.sin(this.chargeTime * 0.3) * 0.5 + 0.5;
            ctx.shadowColor = '#ff0000';
            ctx.shadowBlur = 20 * flashIntensity;
        }
        
        // 绘制详细的敌人
        this.drawDetailedEnemy();
        
        // 血条
        if (this.health < this.maxHealth) {
            this.drawHealthBar();
        }
        
        ctx.restore();
    }
    
    drawDetailedEnemy() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        ctx.save();
        
        // 根据敌人类型绘制不同的科幻设计
        switch(this.type) {
            case 'basic':
                this.drawBasicScout(centerX, centerY);
                break;
            case 'fast':
                this.drawFastFighter(centerX, centerY);
                break;
            case 'heavy':
                this.drawHeavyCruiser(centerX, centerY);
                break;
            case 'sniper':
                this.drawSniperGunboat(centerX, centerY);
                break;
            case 'splitter':
                this.drawEnergyAggregate(centerX, centerY);
                break;
            case 'boss':
                this.drawBossShip(centerX, centerY);
                break;
            default:
                this.drawBasicScout(centerX, centerY);
        }
        
        ctx.restore();
    }
    
    drawBasicScout(centerX, centerY) {
        // 基础敌人：小型侦察机 - 更丰富的设计
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        
        // 主体 - 小型战斗机外形
        ctx.beginPath();
        ctx.moveTo(centerX, this.y + this.height); // 机头向下
        ctx.lineTo(centerX - this.width/3, this.y + this.height * 0.3);
        ctx.lineTo(centerX - this.width/4, this.y);
        ctx.lineTo(centerX + this.width/4, this.y);
        ctx.lineTo(centerX + this.width/3, this.y + this.height * 0.3);
        ctx.closePath();
        ctx.fill();
        
        // 小翼
        ctx.fillStyle = '#cc3333';
        ctx.beginPath();
        ctx.moveTo(centerX - this.width/3, this.y + this.height * 0.4);
        ctx.lineTo(centerX - this.width/2, this.y + this.height * 0.5);
        ctx.lineTo(centerX - this.width/3, this.y + this.height * 0.7);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(centerX + this.width/3, this.y + this.height * 0.4);
        ctx.lineTo(centerX + this.width/2, this.y + this.height * 0.5);
        ctx.lineTo(centerX + this.width/3, this.y + this.height * 0.7);
        ctx.closePath();
        ctx.fill();
        
        // 红色警示灯
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(centerX, centerY + 3, 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 引擎光点
        ctx.fillStyle = '#ffaa00';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(centerX - 6, this.y + 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX + 6, this.y + 3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 装甲线条
        ctx.strokeStyle = '#ff6666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(centerX - this.width/6, this.y + this.height * 0.2);
        ctx.lineTo(centerX + this.width/6, this.y + this.height * 0.2);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
    }
    
    drawFastFighter(centerX, centerY) {
        // 快速敌人：轻型战斗机
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        
        // 流线型机身
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, this.width/2, this.height/2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 机翼
        ctx.fillStyle = '#cc6600';
        ctx.fillRect(centerX - this.width/2, centerY - 3, this.width, 6);
        
        // 橙色推进器
        ctx.fillStyle = '#ff8800';
        ctx.shadowBlur = 15;
        for(let i = 0; i < 3; i++) {
            const engineX = centerX - 10 + i * 10;
            ctx.beginPath();
            ctx.arc(engineX, this.y + 8, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 动态翼展效果
        if (Math.random() < 0.3) {
            ctx.strokeStyle = '#ffaa44';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(centerX - this.width/2, centerY);
            ctx.lineTo(centerX + this.width/2, centerY);
            ctx.stroke();
        }
        
        ctx.shadowBlur = 0;
    }
    
    drawHeavyCruiser(centerX, centerY) {
        // 重型敌人：装甲巡洋舰
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;
        
        // 主装甲块
        ctx.fillRect(centerX - this.width/2, this.y, this.width, this.height);
        
        // 装甲细节
        ctx.fillStyle = '#4d1a66';
        ctx.fillRect(centerX - this.width/3, this.y + 5, this.width * 2/3, this.height - 10);
        
        // 多个武器点
        ctx.fillStyle = '#ffff00';
        ctx.shadowBlur = 8;
        for(let i = 0; i < 3; i++) {
            const weaponX = centerX - 15 + i * 15;
            ctx.beginPath();
            ctx.arc(weaponX, this.y + this.height - 5, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 紫色能量核心
        ctx.fillStyle = '#aa44ff';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // 装甲边缘
        ctx.strokeStyle = '#9933cc';
        ctx.lineWidth = 2;
        ctx.strokeRect(centerX - this.width/2, this.y, this.width, this.height);
        
        ctx.shadowBlur = 0;
    }
    
    drawSniperGunboat(centerX, centerY) {
        // 狙击手：远程炮艇
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        
        // 主体 - 长条形
        ctx.fillRect(centerX - this.width/2, this.y + 10, this.width, this.height - 20);
        
        // 长炮管设计
        ctx.fillStyle = '#cc0020';
        ctx.fillRect(centerX - 3, this.y, 6, this.height);
        
        // 红色瞄准器
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(centerX, this.y + 5, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // 充能时发光效果
        if (this.sniperCharging) {
            const chargeIntensity = Math.sin(this.chargeTime * 0.3) * 0.5 + 0.5;
            ctx.fillStyle = '#ff0000';
            ctx.shadowBlur = 25 * chargeIntensity;
            ctx.globalAlpha = chargeIntensity;
            ctx.beginPath();
            ctx.arc(centerX, this.y + 5, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // 侧面装甲
        ctx.fillStyle = '#990015';
        ctx.fillRect(centerX - this.width/2, centerY - 5, this.width, 10);
        
        ctx.shadowBlur = 0;
    }
    
    drawEnergyAggregate(centerX, centerY) {
        // 分裂敌人：能量聚合体
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        
        // 主能量球
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.width/2, 0, Math.PI * 2);
        ctx.fill();
        
        // 不稳定粒子效果
        const time = Date.now() * 0.01;
        for(let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2 + time;
            const radius = this.width/3 + Math.sin(time + i) * 5;
            const particleX = centerX + Math.cos(angle) * radius;
            const particleY = centerY + Math.sin(angle) * radius;
            
            ctx.fillStyle = '#66ff66';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(particleX, particleY, 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 内部能量核心
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.width/4, 0, Math.PI * 2);
        ctx.fill();
        
        // 能量波动
        if (Math.random() < 0.2) {
            particles.push(new Particle(
                centerX + (Math.random() - 0.5) * this.width,
                centerY + (Math.random() - 0.5) * this.height,
                (Math.random() - 0.5) * 3,
                (Math.random() - 0.5) * 3,
                '#40ff40',
                20
            ));
        }
        
        ctx.shadowBlur = 0;
    }
    
    drawBossShip(centerX, centerY) {
        // Boss：保持原有复杂设计
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20;
        
        // Boss核心
        ctx.fillRect(this.x + 40, this.y + 20, this.width - 80, this.height - 40);
        ctx.fillRect(this.x + 20, this.y + 40, this.width - 40, this.height - 80);
        
        // Boss装甲
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(centerX - 20, centerY - 15, 40, 30);
        
        // 武器系统
        ctx.fillStyle = '#ffff00';
        for(let i = 0; i < 5; i++) {
            const weaponX = this.x + 20 + i * 40;
            ctx.fillRect(weaponX, this.y + this.height - 10, 8, 15);
        }
        
        // 引擎
        ctx.fillStyle = '#ff8000';
        ctx.fillRect(this.x + 10, this.y + this.height - 5, 15, 8);
        ctx.fillRect(this.x + this.width - 25, this.y + this.height - 5, 15, 8);
        
        ctx.shadowBlur = 0;
    }
    
    drawHealthBar() {
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
    
    easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    isOffScreen() {
        return this.y > canvas.height + this.height;
    }
    
    isDead() {
        return this.health <= 0;
    }
}

// 小敌人类（分裂产生）
class SmallEnemy {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.width = 20;
        this.height = 20;
        this.health = 10;
        this.maxHealth = 10;
        this.color = '#80ff80';
        this.points = 5;
        this.life = 300; // 5秒后自动消失
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        
        // 边界反弹
        if (this.x <= 0 || this.x >= canvas.width - this.width) {
            this.vx *= -0.8;
        }
        if (this.y <= 0) {
            this.vy *= -0.8;
        }
        
        // 重力效果
        this.vy += 0.1;
    }
    
    takeDamage(damage) {
        this.health -= damage;
        audioManager.playSound('hit');
        
        // 受伤特效
        for(let i = 0; i < 4; i++) {
            particles.push(new Particle(
                this.x + Math.random() * this.width,
                this.y + Math.random() * this.height,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                this.color,
                15
            ));
        }
    }
    
    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 5;
        
        ctx.beginPath();
        ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    isOffScreen() {
        return this.y > canvas.height + this.height || this.life <= 0;
    }
    
    isDead() {
        return this.health <= 0;
    }
}

// 狙击子弹类
class SniperBullet {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.width = 8;
        this.height = 15;
        this.color = '#ff0000';
        this.trail = [];
        this.damage = 30; // 高伤害
    }
    
    update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 10) {
            this.trail.shift();
        }
        
        this.x += this.vx;
        this.y += this.vy;
    }
    
    draw() {
        ctx.save();
        
        // 轨迹
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }
        
        // 狙击子弹：红色激光束
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;
        
        // 激光主体
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        
        // 白色内核
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x - this.width/4, this.y - this.height/2, this.width/2, this.height);
        
        // 激光头部光点
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.height/2, this.width, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
    
    isOffScreen() {
        return this.y > canvas.height + this.height || this.y < -this.height ||
               this.x < -this.width || this.x > canvas.width + this.width;
    }
}

// 敌人子弹类 - 增强效果
class EnemyBullet {
    constructor(x, y, vx, vy, enemyType = 'basic') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.width = 6;
        this.height = 10;
        this.color = '#ff4040';
        this.trail = [];
        this.enemyType = enemyType; // 添加敌人类型标记
        this.isEnemyBullet = true;
    }

    update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 5) {
            this.trail.shift();
        }

        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        ctx.save();

        // 轨迹
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }

        // 根据敌人类型绘制不同的子弹效果
        ctx.globalAlpha = 1;
        
        switch(this.enemyType) {
            case 'basic':
                this.drawPlasmaBullet();
                break;
            case 'fast':
                this.drawPulseBullet();
                break;
            case 'heavy':
                this.drawHeavyCannonBullet();
                break;
            case 'sniper':
                this.drawSniperBullet();
                break;
            case 'boss':
                this.drawBossBullet();
                break;
            default:
                this.drawPlasmaBullet();
        }

        ctx.restore();
    }
    
    drawPlasmaBullet() {
        // 基础敌人：红色等离子弹
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 8;
        
        // 主等离子球
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
        ctx.fill();
        
        // 火花粒子效果
        if (Math.random() < 0.4) {
            particles.push(new Particle(
                this.x + (Math.random() - 0.5) * this.width,
                this.y + (Math.random() - 0.5) * this.width,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                '#ff6666',
                15
            ));
        }
        
        // 内核
        ctx.fillStyle = '#ffaaaa';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    drawPulseBullet() {
        // 快速敌人：橙色脉冲弹
        const time = Date.now() * 0.02;
        
        // 电弧效果
        ctx.strokeStyle = '#ff8800';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff8800';
        ctx.shadowBlur = 12;
        
        for(let i = 0; i < 3; i++) {
            const angle = (i / 3) * Math.PI * 2 + time;
            const x1 = this.x + Math.cos(angle) * this.width * 1.5;
            const y1 = this.y + Math.sin(angle) * this.width * 1.5;
            
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(x1, y1);
            ctx.stroke();
        }
        
        // 中心脉冲球
        ctx.fillStyle = '#ff8800';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    drawHeavyCannonBullet() {
        // 重型敌人：紫色重炮弹
        const pulseIntensity = Math.sin(Date.now() * 0.015) * 0.3 + 0.7;
        
        // 扭曲空间效果
        ctx.fillStyle = '#8040ff';
        ctx.shadowColor = '#8040ff';
        ctx.shadowBlur = 20 * pulseIntensity;
        ctx.globalAlpha = 0.8;
        
        // 大型能量球
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 内部扭曲环
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#aa66ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width, 0, Math.PI * 2);
        ctx.stroke();
        
        // 能量核心
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width * 0.4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    drawSniperBullet() {
        // 狙击手：红色激光束（类似玩家激光但更细更快）
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 15;
        
        // 激光主体
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        
        // 白色内核
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x - this.width/4, this.y - this.height/2, this.width/2, this.height);
        
        // 激光头部光点
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.height/2, this.width, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
    }
    
    drawBossBullet() {
        // Boss：威胁性能量弹
        const time = Date.now() * 0.01;
        const pulseIntensity = Math.sin(time) * 0.4 + 0.6;
        
        // 外层威胁光环
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15 * pulseIntensity;
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width * 2, 0, Math.PI * 2);
        ctx.fill();
        
        // 主弹体
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 12;
        ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
        
        // 能量波纹
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.globalAlpha = pulseIntensity;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.width * 1.5, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
    }

    isOffScreen() {
        return this.y > canvas.height + this.height || this.y < -this.height ||
               this.x < -this.width || this.x > canvas.width + this.width;
    }
}

// 增强的敌人生成函数
function spawnEnhancedEnemies() {
    // 检查是否应该生成最终Boss
    if (!bossSpawned && shouldSpawnFinalBoss()) {
        spawnFinalBoss();
        return;
    }
    
    if (Math.random() < 0.015 + level * 0.003) {
        let enemyType = 'basic';
        const rand = Math.random();
        
        // 根据等级决定敌人类型
        if (level >= 6 && rand < 0.05) {
            enemyType = 'splitter';
        } else if (level >= 4 && rand < 0.12) { // 从0.15降低到0.12
            enemyType = 'sniper';
        } else if (level >= 3 && rand < 0.25) {
            enemyType = 'heavy';
        } else if (level >= 2 && rand < 0.55) {
            enemyType = 'fast';
        }
        
        enemies.push(new EnhancedEnemy(enemyType));
    }
}

// 检查是否应该生成最终Boss
function shouldSpawnFinalBoss() {
    const timeCondition = gameTime >= BOSS_TRIGGER.timeMinutes * 60 * 60; // 转换为帧数
    const levelCondition = level >= BOSS_TRIGGER.level;
    
    return timeCondition || levelCondition;
}

// 生成最终Boss
function spawnFinalBoss() {
    bossSpawned = true;
    finalBoss = new FinalBoss();
    enemies.push(finalBoss);
    
    // 显示Boss警告
    showBossWarning();
}

// Boss警告效果
function showBossWarning() {
    // 这个函数需要在主文件中实现
    if (window.showBossAlert) {
        window.showBossAlert();
    }
}

// 更新游戏时间
function updateGameTime() {
    gameTime++;
}

// 导出函数供主文件使用
if (typeof window !== 'undefined') {
    window.EnhancedEnemy = EnhancedEnemy;
    window.SmallEnemy = SmallEnemy;
    window.SniperBullet = SniperBullet;
    window.spawnEnhancedEnemies = spawnEnhancedEnemies;
    window.updateGameTime = updateGameTime;
    window.aimingLines = []; // 瞄准线数组
}
