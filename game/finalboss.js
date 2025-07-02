// 最终Boss系统 - finalboss.js
// 包含复杂的攻击模式、弹幕系统、冲撞攻击等

// Boss状态枚举
const BOSS_STATES = {
    ENTERING: 'entering',
    PHASE1: 'phase1',
    PHASE2: 'phase2',
    PHASE3: 'phase3',
    CHARGING: 'charging',
    DEFEATED: 'defeated'
};





// 最终Boss类
class FinalBoss {
    constructor() {
        this.type = 'finalBoss';
        this.x = canvas.width / 2;
        this.y = -150;
        this.width = 200;
        this.height = 120;
        this.speed = 1;
        this.health = 5000;  // 血量翻倍
        this.maxHealth = 5000;
        this.color = '#ff0080';
        this.points = 500;

        // Boss状态管理
        this.state = BOSS_STATES.ENTERING;
        this.stateTimer = 0;
        this.phaseTransitionTimer = 0;

        // 移动相关
        this.targetX = canvas.width / 2 - this.width / 2;
        this.targetY = 80;
        this.entryProgress = 0;

        // 攻击模式
        this.attackPattern = 0;
        this.attackTimer = 0;
        this.lastAttack = 0;

        // 激光蓄力攻击
        this.laserCharging = false;
        this.laserChargeTime = 0;
        this.laserMaxChargeTime = 80; // 短蓄力
        this.laserWidth = 80; // 激光宽度
        this.laserTargetX = 0;
        this.laserTargetY = 0;

        // 弹幕系统
        this.spiralAngle = 0;
        this.burstCount = 0;

        // 视觉效果
        this.animFrame = 0;
        this.flashIntensity = 0;
        this.shakeIntensity = 0;

        // 音效
        this.playBossMusic();


    }

    update() {
        this.animFrame++;
        this.stateTimer++;

        // 更新Boss状态机
        switch (this.state) {
            case BOSS_STATES.ENTERING:
                this.updateEntering();
                break;
            case BOSS_STATES.PHASE1:
                this.updatePhase1();
                break;
            case BOSS_STATES.PHASE2:
                this.updatePhase2();
                break;
            case BOSS_STATES.PHASE3:
                this.updatePhase3();
                break;
            case BOSS_STATES.CHARGING:
                this.updateLaserCharging();
                break;
            case BOSS_STATES.DEFEATED:
                this.updateDefeated();
                break;
        }

        // 更新视觉效果
        this.updateVisualEffects();

        // 边界检测
        this.x = Math.max(0, Math.min(canvas.width - this.width, this.x));
    }

    updateEntering() {
        // Boss入场动画
        this.entryProgress += 0.008;

        if (this.entryProgress >= 1) {
            this.state = BOSS_STATES.PHASE1;
            this.stateTimer = 0;
            this.x = this.targetX;
            this.y = this.targetY;
            return;
        }

        // 平滑入场
        const t = this.easeInOut(this.entryProgress);
        this.y = -150 + (this.targetY + 150) * t;

        // 入场震屏效果
        this.shakeIntensity = (1 - t) * 5;
    }

    updatePhase1() {
        // 第一阶段：基础弹幕 + 偶尔冲撞
        this.updateBasicMovement();

        // 攻击逻辑
        if (this.stateTimer % 180 === 0) { // 每3秒攻击
            this.executePhase1Attack();
        }

        // 检查阶段转换
        if (this.health <= this.maxHealth * 0.66) {
            this.transitionToPhase2();
        }
    }

    updatePhase2() {
        // 第二阶段：增强弹幕 + 更频繁冲撞
        this.updateBasicMovement();

        // 更频繁的攻击
        if (this.stateTimer % 120 === 0) { // 每2秒攻击
            this.executePhase2Attack();
        }

        // 检查阶段转换
        if (this.health <= this.maxHealth * 0.33) {
            this.transitionToPhase3();
        }
    }

    updatePhase3() {
        // 第三阶段：疯狂弹幕 + 连续冲撞
        this.updateBasicMovement();

        // 疯狂攻击
        if (this.stateTimer % 60 === 0) { // 每1秒攻击
            this.executePhase3Attack();
        }

        // 检查败北
        if (this.health <= 0) {
            this.state = BOSS_STATES.DEFEATED;
            this.stateTimer = 0;
        }
    }



    updateDefeated() {
        // Boss败北动画
        this.y += 2; // 缓慢下沉
        this.flashIntensity = Math.sin(this.stateTimer * 0.2) * 0.5 + 0.5;

        // 爆炸特效
        if (this.stateTimer % 20 === 0) {
            this.createDefeatExplosion();
        }

        // 游戏胜利检查
        if (this.stateTimer > 300) { // 5秒后
            this.triggerGameVictory();
        }

        
    }

    updateBasicMovement() {
        // Boss基础移动模式：左右摆动
        const moveRange = canvas.width - this.width - 40;
        const centerX = canvas.width / 2 - this.width / 2;
        const oscillation = Math.sin(this.stateTimer * 0.02) * (moveRange / 2);
        this.x = centerX + oscillation;
    }

    executePhase1Attack() {
        const attackType = Math.floor(Math.random() * 3);

        switch (attackType) {
            case 0:
                this.attackSpiral();
                break;
            case 1:
                this.attackSpread();
                break;
            case 2:
                if (Math.random() < 0.3) { // 30%概率激光炮
                    this.startLaserCharge();
                } else {
                    this.attackDirectional();
                }
                break;
        }
    }

    executePhase2Attack() {
        const attackType = Math.floor(Math.random() * 4);

        switch (attackType) {
            case 0:
                this.attackSpiralBurst();
                break;
            case 1:
                this.attackCrossPattern();
                break;
            case 2:
                this.attackWavePattern();
                break;
            case 3:
                if (Math.random() < 0.5) { // 50%概率激光炮
                    this.startLaserCharge();
                } else {
                    this.attackSpread();
                }
                break;
        }
    }

    executePhase3Attack() {
        const attackType = Math.floor(Math.random() * 5);

        switch (attackType) {
            case 0:
                this.attackChaosSpiral();
                break;
            case 1:
                this.attackBulletHell();
                break;
            case 2:
                this.attackLaserSweep();
                break;
            case 3:
                this.attackHomingMissiles();
                break;
            case 4:
                if (Math.random() < 0.7) { // 70%概率激光炮
                    this.startLaserCharge();
                } else {
                    this.attackCrossPattern();
                }
                break;
        }
    }

    // 攻击模式实现
    attackSpiral() {
        // 螺旋弹幕 - 增加弹幕量
        for (let i = 0; i < 12; i++) { // 从8发增加到12发
            const angle = this.spiralAngle + (i * Math.PI / 6); // 角度调整
            const vx = Math.cos(angle) * 4;
            const vy = Math.sin(angle) * 4 + 2;

            bullets.push(new BossBullet(
                this.x + this.width / 2,
                this.y + this.height,
                vx, vy, 'spiral'
            ));
        }
        this.spiralAngle += 0.3;
    }

    attackSpread() {
        // 扇形射击 - 增加弹幕量
        for (let i = -6; i <= 6; i++) { // 从9发增加到13发
            const angle = i * 0.25; // 角度更密集
            const vx = Math.sin(angle) * 5;
            const vy = Math.cos(angle) * 5 + 2;

            bullets.push(new BossBullet(
                this.x + this.width / 2,
                this.y + this.height,
                vx, vy, 'spread'
            ));
        }
    }

    attackDirectional() {
        // 向玩家方向射击
        const dx = player.x + player.width / 2 - (this.x + this.width / 2);
        const dy = player.y + player.height / 2 - (this.y + this.height / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            for (let i = 0; i < 5; i++) {
                const spread = (i - 2) * 0.2;
                const vx = (dx / distance) * 6 + spread;
                const vy = (dy / distance) * 6;

                bullets.push(new BossBullet(
                    this.x + this.width / 2,
                    this.y + this.height,
                    vx, vy, 'directional'
                ));
            }
        }
    }

    attackSpiralBurst() {
        // 螺旋爆发
        for (let ring = 0; ring < 3; ring++) {
            for (let i = 0; i < 12; i++) {
                const angle = this.spiralAngle + (i * Math.PI / 6) + (ring * 0.5);
                const speed = 3 + ring;
                const vx = Math.cos(angle) * speed;
                const vy = Math.sin(angle) * speed + 1;

                setTimeout(() => {
                    bullets.push(new BossBullet(
                        this.x + this.width / 2,
                        this.y + this.height,
                        vx, vy, 'burst'
                    ));
                }, ring * 200);
            }
        }
        this.spiralAngle += 0.5;
    }

    attackCrossPattern() {
        // 十字弹幕
        const directions = [
            { vx: 0, vy: 5 },   // 下
            { vx: 5, vy: 0 },   // 右
            { vx: -5, vy: 0 },  // 左
            { vx: 3.5, vy: 3.5 }, // 右下
            { vx: -3.5, vy: 3.5 } // 左下
        ];

        directions.forEach(dir => {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    bullets.push(new BossBullet(
                        this.x + this.width / 2,
                        this.y + this.height,
                        dir.vx, dir.vy, 'cross'
                    ));
                }, i * 100);
            }
        });
    }

    attackWavePattern() {
        // 波浪弹幕
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const waveX = (i - 7) * 30;
                const waveY = Math.sin(i * 0.5) * 2 + 4;

                bullets.push(new BossBullet(
                    this.x + this.width / 2 + waveX,
                    this.y + this.height,
                    0, waveY, 'wave'
                ));
            }, i * 50);
        }
    }

    attackChaosSpiral() {
        // 混沌螺旋
        for (let i = 0; i < 16; i++) {
            const angle1 = this.spiralAngle + (i * Math.PI / 8);
            const angle2 = -this.spiralAngle + (i * Math.PI / 8);

            [angle1, angle2].forEach(angle => {
                const vx = Math.cos(angle) * 5;
                const vy = Math.sin(angle) * 5 + 2;

                bullets.push(new BossBullet(
                    this.x + this.width / 2,
                    this.y + this.height,
                    vx, vy, 'chaos'
                ));
            });
        }
        this.spiralAngle += 0.4;
    }

    attackBulletHell() {
        // 弹幕地狱
        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const speed = 3 + Math.random() * 3;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed + 1;

            bullets.push(new BossBullet(
                this.x + this.width / 2,
                this.y + this.height,
                vx, vy, 'hell'
            ));
        }
    }

    attackLaserSweep() {
        // 激光扫射（用连续子弹模拟）
        for (let i = 0; i < 20; i++) {
            setTimeout(() => {
                const sweepAngle = -Math.PI / 3 + (i / 19) * (Math.PI * 2 / 3);
                const vx = Math.cos(sweepAngle) * 8;
                const vy = Math.sin(sweepAngle) * 8 + 2;

                bullets.push(new LaserBullet(
                    this.x + this.width / 2,
                    this.y + this.height,
                    vx, vy
                ));
            }, i * 30);
        }
    }

    attackHomingMissiles() {
        // 追踪导弹
        for (let i = 0; i < 4; i++) {
            setTimeout(() => {
                bullets.push(new HomingMissile(
                    this.x + this.width / 2 + (i - 1.5) * 40,
                    this.y + this.height,
                    player
                ));
            }, i * 300);
        }
    }

    startLaserCharge() {
        // 开始激光蓄力攻击
        this.state = BOSS_STATES.CHARGING;
        this.laserCharging = true;
        this.laserChargeTime = 0;

        // 锁定玩家位置
        this.laserTargetX = player.x + player.width / 2;
        this.laserTargetY = player.y + player.height / 2;

        // 显示激光蓄力警告
        this.showLaserWarning();
    }

    updateLaserCharging() {
        if (this.laserCharging) {
            this.laserChargeTime++;

            // 蓄力完成，发射激光
            if (this.laserChargeTime >= this.laserMaxChargeTime) {
                this.fireLaserBeam();
                this.laserCharging = false;
                this.state = this.getPreviousState();
                this.stateTimer = 0;
            }

            // 蓄力闪烁效果
            const chargeProgress = this.laserChargeTime / this.laserMaxChargeTime;
            this.flashIntensity = Math.sin(this.laserChargeTime * 0.3) * chargeProgress + 0.2;
        }
    }

    fireLaserBeam() {
        // 发射宽激光束
        const laserStartX = this.x + this.width / 2;
        const laserStartY = this.y + this.height;

        // 创建多条激光束形成宽激光效果
        const beamCount = 8; // 8条激光束组成宽激光
        for (let i = 0; i < beamCount; i++) {
            const offsetX = (i - beamCount / 2) * (this.laserWidth / beamCount);

            bullets.push(new BossLaserBeam(
                laserStartX + offsetX,
                laserStartY,
                this.laserTargetX + offsetX,
                this.laserTargetY,
                i === Math.floor(beamCount / 2) // 中心激光更亮
            ));
        }

        // 激光发射特效
        this.createLaserFireEffect();
    }

    showLaserWarning() {
        // 创建激光蓄力警告区域
        const warningZone = {
            centerX: this.laserTargetX,
            centerY: this.laserTargetY,
            width: this.laserWidth,
            height: canvas.height - this.y - this.height,
            life: this.laserMaxChargeTime,
            maxLife: this.laserMaxChargeTime,
            color: '#ff0000',
            type: 'laser'
        };

        if (window.chargeWarnings) {
            window.chargeWarnings.push(warningZone);
        }
    }

    createLaserFireEffect() {
        // 激光发射时的特效
        for (let i = 0; i < 20; i++) {
            particles.push(new Particle(
                this.x + this.width / 2 + (Math.random() - 0.5) * this.width,
                this.y + this.height,
                (Math.random() - 0.5) * 10,
                Math.random() * 5 + 2,
                '#ff0080',
                40
            ));
        }

        // 屏幕震动
        this.shakeIntensity = 8;
    }

    transitionToPhase2() {
        this.state = BOSS_STATES.PHASE2;
        this.stateTimer = 0;
        this.flashIntensity = 1;
        this.createPhaseTransitionEffect();
    }

    transitionToPhase3() {
        this.state = BOSS_STATES.PHASE3;
        this.stateTimer = 0;
        this.flashIntensity = 1;
        this.createPhaseTransitionEffect();
    }

    createPhaseTransitionEffect() {
        // 阶段转换特效
        for (let i = 0; i < 30; i++) {
            particles.push(new Particle(
                this.x + Math.random() * this.width,
                this.y + Math.random() * this.height,
                (Math.random() - 0.5) * 15,
                (Math.random() - 0.5) * 15,
                '#ff0080',
                60
            ));
        }
    }

    createDefeatExplosion() {
        // 败北爆炸特效
        const explosionX = this.x + Math.random() * this.width;
        const explosionY = this.y + Math.random() * this.height;

        explosions.push(new Explosion(explosionX, explosionY, 60));

        // 粒子效果
        for (let i = 0; i < 15; i++) {
            particles.push(new Particle(
                explosionX,
                explosionY,
                (Math.random() - 0.5) * 20,
                (Math.random() - 0.5) * 20,
                '#ffff00',
                80
            ));
        }
    }

    triggerGameVictory() {
        // 触发游戏胜利
        if (window.triggerVictory) {
            window.triggerVictory();
        } else {
            // 备用方案：直接设置游戏状态
            gameState = 'victory';
            console.log('Boss defeated! Game victory triggered!');
        }
    }

    getPreviousState() {
        // 根据血量返回对应阶段
        if (this.health > this.maxHealth * 0.66) {
            return BOSS_STATES.PHASE1;
        } else if (this.health > this.maxHealth * 0.33) {
            return BOSS_STATES.PHASE2;
        } else {
            return BOSS_STATES.PHASE3;
        }
    }

    updateVisualEffects() {
        // 更新视觉效果
        if (this.flashIntensity > 0) {
            this.flashIntensity -= 0.02;
        }

        if (this.shakeIntensity > 0) {
            this.shakeIntensity -= 0.1;
        }
    }

    takeDamage(damage) {
        this.health -= damage;
        this.flashIntensity = 0.8;
        audioManager.playSound('hit');

        // 受伤特效
        for (let i = 0; i < 12; i++) {
            particles.push(new Particle(
                this.x + Math.random() * this.width,
                this.y + Math.random() * this.height,
                (Math.random() - 0.5) * 8,
                (Math.random() - 0.5) * 8,
                this.color,
                30
            ));
        }
    }

    draw() {
        ctx.save();

        // 震屏效果
        if (this.shakeIntensity > 0) {
            ctx.translate(
                (Math.random() - 0.5) * this.shakeIntensity,
                (Math.random() - 0.5) * this.shakeIntensity
            );
        }

        // 闪烁效果
        if (this.flashIntensity > 0) {
            ctx.globalAlpha = 1 - this.flashIntensity * 0.5;
        }

        // 绘制Boss主体
        this.drawBossBody();

        // 绘制Boss血条
        this.drawBossHealthBar();

        ctx.restore();
    }

    drawBossBody() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        // 主体 - 复杂形状
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
        for (let i = 0; i < 5; i++) {
            const weaponX = this.x + 20 + i * 40;
            ctx.fillRect(weaponX, this.y + this.height - 10, 8, 15);
        }

        // 引擎
        ctx.fillStyle = '#ff8000';
        ctx.fillRect(this.x + 10, this.y + this.height - 5, 15, 8);
        ctx.fillRect(this.x + this.width - 25, this.y + this.height - 5, 15, 8);

        // 激光蓄力时的特殊效果
        if (this.laserCharging) {
            const chargeProgress = this.laserChargeTime / this.laserMaxChargeTime;
            const intensity = Math.sin(this.laserChargeTime * 0.3) * chargeProgress + 0.3;

            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 4 + intensity * 4;
            ctx.globalAlpha = 0.8;
            ctx.strokeRect(this.x - 5, this.y - 5, this.width + 10, this.height + 10);

            // 蓄力光环效果
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.globalAlpha = intensity;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 60 + intensity * 20, 0, Math.PI * 2);
            ctx.stroke();

            ctx.globalAlpha = 1;
        }

        ctx.shadowBlur = 0;
    }

    drawBossHealthBar() {
        // Boss专用大血条 - 移到屏幕底部，完全避开其他UI
        const barWidth = canvas.width - 100; // 减小宽度
        const barHeight = 25; // 稍微增大高度
        const barX = 50; // 居中
        const barY = canvas.height - 80; // 放在屏幕底部

        // 背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(barX - 5, barY - 5, barWidth + 10, barHeight + 10);

        // 血条底色
        ctx.fillStyle = '#400000';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        // 血条 - 增强视觉效果
        const healthPercent = Math.max(0, this.health / this.maxHealth);

        // 渐变色血条
        const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth * healthPercent, barY);
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(1, healthPercent > 0.5 ? '#ff8000' : '#ff4040');

        ctx.fillStyle = gradient;
        ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

        // 添加血量数值显示
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(this.health)} / ${this.maxHealth}`, barX + barWidth / 2, barY + barHeight / 2 + 5);

        // 血条边框
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);

        // Boss名称
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('FINAL BOSS', canvas.width / 2, barY - 10);

        // 阶段指示
        let phaseText = '';
        switch (this.state) {
            case BOSS_STATES.PHASE1:
                phaseText = 'PHASE I';
                break;
            case BOSS_STATES.PHASE2:
                phaseText = 'PHASE II';
                break;
            case BOSS_STATES.PHASE3:
                phaseText = 'PHASE III - FINAL';
                break;
        }

        if (phaseText) {
            ctx.fillStyle = '#ffff00';
            ctx.font = 'bold 12px Arial';
            ctx.fillText(phaseText, canvas.width / 2, barY + barHeight + 20);
        }
    }

    playBossMusic() {
        // Boss音乐（简单实现）
        if (audioManager) {
            audioManager.playSound('explosion'); // 临时使用现有音效
        }
    }

    easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    isOffScreen() {
        return false; // Boss不会离开屏幕
    }

    isDead() {
        return this.health <= 0;
    }
}

// Boss专用子弹类
class BossBullet {
    constructor(x, y, vx, vy, type = 'normal') {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.type = type;
        this.width = 8;
        this.height = 12;
        this.trail = [];
        this.life = 360; // 6秒生命周期 - 优化性能
        this.isEnemyBullet = true; 

        // 根据类型设置属性
        switch (type) {
            case 'spiral':
                this.color = '#ff0080';
                this.damage = 20;
                break;
            case 'spread':
                this.color = '#ff4040';
                this.damage = 18;
                break;
            case 'directional':
                this.color = '#ff8040';
                this.damage = 22;
                break;
            case 'burst':
                this.color = '#ff0040';
                this.damage = 16;
                break;
            case 'cross':
                this.color = '#8040ff';
                this.damage = 20;
                break;
            case 'wave':
                this.color = '#4080ff';
                this.damage = 18;
                break;
            case 'chaos':
                this.color = '#ff4080';
                this.damage = 25;
                break;
            case 'hell':
                this.color = '#ff0000';
                this.damage = 30;
                break;
            default:
                this.color = '#ff4040';
                this.damage = 20;
        }
    }

    update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 8) {
            this.trail.shift();
        }

        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        // 特殊行为
        if (this.type === 'wave') {
            this.vx += Math.sin(this.life * 0.1) * 0.2;
        }
    }

    draw() {
        ctx.save();

        // 轨迹
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

        // 主子弹
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 12;
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

        ctx.restore();
    }

    isOffScreen() {
        return this.y > canvas.height + this.height || this.y < -this.height ||
            this.x < -this.width || this.x > canvas.width + this.width || this.life <= 0;
    }
}

// 激光子弹类
class LaserBullet extends BossBullet {
    constructor(x, y, vx, vy) {
        super(x, y, vx, vy, 'laser');
        this.width = 6;
        this.height = 20;
        this.color = '#ff0000';
        this.damage = 35;
        this.isEnemyBullet = true;
    }

    draw() {
        ctx.save();

        // 激光效果
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20;
        ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

        // 内核
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.x - this.width / 4, this.y - this.height / 2, this.width / 2, this.height);

        ctx.restore();
    }
}

// 追踪导弹类
class HomingMissile {
    constructor(x, y, target) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.vx = 0;
        this.vy = 2;
        this.speed = 3;
        this.turnRate = 0.1;
        this.width = 10;
        this.height = 15;
        this.color = '#ff8000';
        this.damage = 40;
        this.life = 600;
        this.trail = [];
        this.isEnemyBullet = true;
    }

    update() {
        // 追踪逻辑
        const dx = this.target.x + this.target.width / 2 - this.x;
        const dy = this.target.y + this.target.height / 2 - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            const targetVx = (dx / distance) * this.speed;
            const targetVy = (dy / distance) * this.speed;

            // 平滑转向
            this.vx += (targetVx - this.vx) * this.turnRate;
            this.vy += (targetVy - this.vy) * this.turnRate;
        }

        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        // 轨迹
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 10) {
            this.trail.shift();
        }
    }

    draw() {
        ctx.save();

        // 轨迹
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }

        // 导弹主体
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 15;

        // 导弹形状
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height / 2);
        ctx.lineTo(this.x - this.width / 2, this.y + this.height / 2);
        ctx.lineTo(this.x + this.width / 2, this.y + this.height / 2);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    isOffScreen() {
        return this.y > canvas.height + this.height || this.y < -this.height ||
            this.x < -this.width || this.x > canvas.width + this.width || this.life <= 0;
    }
}

// Boss激光束类 - 宽激光攻击
class BossLaserBeam {
    constructor(x, y, targetX, targetY, isCenter = false) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.targetX = targetX;
        this.targetY = targetY;
        this.isCenter = isCenter;

        // 计算方向
        const dx = targetX - x;
        const dy = targetY - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        this.vx = (dx / distance) * 12; // 很快的激光
        this.vy = (dy / distance) * 12;

        this.width = isCenter ? 12 : 8; // 中心激光更粗
        this.height = 30;
        this.color = isCenter ? '#ffffff' : '#ff0080';
        this.damage = isCenter ? 40 : 30; // 中心激光伤害更高
        this.life = 80; // 缩短生命周期 - 优化性能
        this.trail = [];
        this.isEnemyBullet = true;
    }

    update() {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > 15) { // 更长的轨迹
            this.trail.shift();
        }

        this.x += this.vx;
        this.y += this.vy;
        this.life--;

        // 激光粒子效果
        if (Math.random() < 0.6) {
            particles.push(new Particle(
                this.x + (Math.random() - 0.5) * this.width,
                this.y + (Math.random() - 0.5) * this.height,
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 4,
                this.color,
                25
            ));
        }
    }

    draw() {
        ctx.save();

        // 激光轨迹 - 更粗更亮
        if (this.trail.length > 1) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.width;
            ctx.globalAlpha = 0.8;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 20;

            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            ctx.stroke();
        }

        // 激光主体 - 威慑力十足
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 25;

        // 激光矩形主体
        ctx.fillRect(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );

        // 中心激光的额外效果
        if (this.isCenter) {
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 30;
            ctx.fillRect(
                this.x - this.width / 4,
                this.y - this.height / 2,
                this.width / 2,
                this.height
            );

            // 中心光点
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    isOffScreen() {
        return this.y > canvas.height + this.height || this.y < -this.height ||
            this.x < -this.width || this.x > canvas.width + this.width || this.life <= 0;
    }
}

// 导出类供主文件使用
if (typeof window !== 'undefined') {
    window.FinalBoss = FinalBoss;
    window.BossBullet = BossBullet;
    window.BossLaserBeam = BossLaserBeam; // 新增激光束类
    window.LaserBullet = LaserBullet;
    window.HomingMissile = HomingMissile;
    window.chargeWarnings = []; // 警告数组（现在用于激光警告）
}
