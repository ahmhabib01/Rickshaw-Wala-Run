
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }
        }
    },

    scene: [MenuScene, GameScene] 
};

const game = new Phaser.Game(config);

let playerMoney = 100;
let upgradeLevel = {
    wheel: 0, 
    horn: 0, 
    suspension: 0 
};
let RICKSHAW_SPEED = 250;
const OBSTACLE_SPEED = 200;
let LANE_WIDTH = 100;


class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
    }

    preload() {
       
    }

    create() {
       
        this.add.rectangle(0, 0, config.width, config.height, 0x000000, 1).setOrigin(0).setDepth(10);
        
        this.add.text(config.width / 2, 50, 'কালু মামার গ্যারেজ (আপগ্রেড শপ)', { 
            fontSize: '36px', fill: '#FFD700', align: 'center'
        }).setOrigin(0.5).setDepth(11);
        
        const shopMoneyText = this.add.text(config.width / 2, 110, `আপনার টাকা: ${playerMoney} ৳`, { 
            fontSize: '28px', fill: '#00FF00', align: 'center'
        }).setOrigin(0.5).setDepth(11);

        let currentY = 180;
        
        const upgrades = [
            { key: 'wheel', name: 'চাকা (গতি)', cost: 150, description: 'রিকশার বেস গতি বাড়ায়' },
            { key: 'suspension', name: 'সাসপেনশন (গর্তের প্রভাব)', cost: 100, description: 'গর্তে পড়লে ধাক্কা কম খাবে' },
            { key: 'horn', name: 'জাদু হর্ন (বাধা এড়ানো)', cost: 200, description: 'পুলিশের ফাইন এড়ানোর চান্স দেয়' }
        ];

        upgrades.forEach(item => {
            const currentLvl = upgradeLevel[item.key];
            const nextCost = item.cost * (currentLvl + 1);
            
            const upgradeText = this.add.text(config.width / 2, currentY, 
                `${item.name} | লেভেল: ${currentLvl}\n` +
                `${item.description} | খরচ: ${nextCost} ৳`, 
                { fontSize: '20px', fill: '#FFFFFF', backgroundColor: '#333333' }
            ).setOrigin(0.5).setDepth(11).setInteractive();

            upgradeText.on('pointerdown', () => {
                this.handleUpgrade(item.key, nextCost, shopMoneyText);
            });
            
            currentY += 80;
        });


        this.add.text(config.width / 2, config.height - 80, 'খেলা শুরু করুন (ENTER)', { 
            fontSize: '36px', fill: '#00FFFF', backgroundColor: '#5D00FF', padding: 10
        }).setOrigin(0.5).setDepth(11);
        
        this.input.keyboard.on('keydown-ENTER', () => {
           
            this.scene.start('GameScene');
        });

    }

    handleUpgrade(key, cost, moneyTextRef) {
        if (playerMoney >= cost) {
            playerMoney -= cost;
            upgradeLevel[key]++;
            
            if (key === 'wheel') {
                RICKSHAW_SPEED = 250 + (upgradeLevel.wheel * 50); 
            }
            
            moneyTextRef.setText(`আপনার টাকা: ${playerMoney} ৳`);
            
          
            const successMessage = this.add.text(config.width / 2, config.height / 2, 
                `আপগ্রেড সফল!`, 
                { fontSize: '40px', fill: '#00FF00', backgroundColor: '#000000', padding: 10 }
            ).setOrigin(0.5).setDepth(12);

           
            this.time.delayedCall(2000, () => {
                successMessage.destroy();
                this.scene.start('MenuScene'); 
            });
        } else {

            const failMessage = this.add.text(config.width / 2, config.height / 2, 
                'টাকা কম আছে! আরো ভাড়া মারুন!', 
                { fontSize: '40px', fill: '#FF0000', backgroundColor: '#000000', padding: 10 }
            ).setOrigin(0.5).setDepth(12);
            
            this.time.delayedCall(1500, () => failMessage.destroy());
        }
    }
}



class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
     
        this.isGameOver = false;
        this.isPickingUp = false;
        this.isPenaltyActive = false;
        this.currentLane = 0;
        this.currentFare = 0;
        this.roadScrollSpeed = 7;
    }

    preload() {

        this.load.image('iso_road', 'assets/iso_road_tile.png'); 
        this.load.image('iso_rickshaw', 'assets/iso_rickshaw.png');
        this.load.image('iso_car', 'assets/iso_car.png'); 
        this.load.image('iso_passenger', 'assets/iso_passenger.png'); 
        this.load.image('iso_target', 'assets/iso_target_sign.png'); 
        this.load.image('iso_police', 'assets/iso_police_asset.png'); 
        this.load.image('iso_pothole', 'assets/iso_pothole.png'); 
    }

    create() {

        this.isGameOver = false;
        this.isPickingUp = false;
        this.isPenaltyActive = false;
        this.currentLane = 0;
        this.currentFare = 0;
        
 
        this.road = this.add.tileSprite(config.width / 2, config.height / 2, config.width, config.height, 'iso_road');

        const startX = this.calculateRoadPosition(this.currentLane);
        this.rickshawala = this.physics.add.sprite(startX, config.height - 100, 'iso_rickshaw');
        this.rickshawala.setScale(0.8); 
        this.rickshawala.setCollideWorldBounds(true); 
        this.rickshawala.setDepth(1); 


        this.cursors = this.input.keyboard.createCursorKeys();
        this.restartKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        
        this.cursors.left.on('down', () => this.changeLane(-1));
        this.cursors.right.on('down', () => this.changeLane(1));
        

        this.scoreText = this.add.text(10, 10, 'ভাড়া: 0 টাকা', { fontSize: '24px', fill: '#FFD700', backgroundColor: '#000000' }).setDepth(2);
        this.moneyText = this.add.text(10, 40, 'টাকা: ' + playerMoney + ' ৳', { fontSize: '20px', fill: '#00FF00', backgroundColor: '#000000' }).setDepth(2);
        this.missionText = this.add.text(config.width / 2, 10, 'মিশন: কোনো যাত্রী নেই', { fontSize: '20px', fill: '#FFFFFF', backgroundColor: '#000000' }).setOrigin(0.5).setDepth(2);


        this.obstacles = this.physics.add.group();
        this.passengers = this.physics.add.group();
        this.missionTarget = this.physics.add.group();
        

        this.time.addEvent({
            delay: 1000, 
            callback: this.spawnObstacle,
            callbackScope: this,
            loop: true
        });
        
        this.time.addEvent({
            delay: 5000, 
            callback: this.spawnPassenger,
            callbackScope: this,
            loop: true
        });

        this.physics.add.collider(this.rickshawala, this.obstacles, this.hitObstacle, null, this);
        this.physics.add.overlap(this.rickshawala, this.passengers, this.pickUpPassenger, null, this);
        this.physics.add.overlap(this.rickshawala, this.missionTarget, this.dropOffPassenger, null, this); 
    }

    calculateRoadPosition(lane) {
        const center = config.width / 2;
        return center + (lane * LANE_WIDTH); 
    }
    


    changeLane(direction) {
        if (this.isGameOver || this.isPickingUp || this.isPenaltyActive) return;
        
        const newLane = Phaser.Math.Clamp(this.currentLane + direction, -1, 1);
        
        if (newLane !== this.currentLane) {
            this.currentLane = newLane;
            const targetX = this.calculateRoadPosition(this.currentLane);
            
            this.tweens.add({
                targets: this.rickshawala,
                x: targetX,
                duration: 150, 
                ease: 'Sine.easeOut'
            });
        }
    }
    
    spawnObstacle() {
        if (this.isGameOver) return;
        
        const lane = Phaser.Math.RND.pick([-1, 0, 1]);
        const x = this.calculateRoadPosition(lane);
        const y = -50; 
        
        let obstacleType;
        
        if (Math.random() < 0.08) { 
            obstacleType = 'iso_police';
        } else if (Math.random() < 0.16) { 
            obstacleType = 'iso_pothole';
        } else {
            obstacleType = Phaser.Math.RND.pick(['iso_car', 'iso_car']); 
        }
        
        let object = this.obstacles.create(x, y, obstacleType);
        object.setScale(0.7); 
        object.setVelocityY(OBSTACLE_SPEED); 
        object.setData('type', obstacleType);
        
        this.time.delayedCall(4000, () => {
            if (object.active) object.destroy();
        });
    }

    spawnPassenger() {
        if (this.isGameOver || this.isMissionActive || this.isPenaltyActive) return;
        
        const lane = Phaser.Math.RND.pick([-1, 0, 1]);
        const x = this.calculateRoadPosition(lane);
        const y = -50; 
        
        let object = this.passengers.create(x, y, 'iso_passenger');
        object.setScale(0.6); 
        object.setVelocityY(OBSTACLE_SPEED); 
        
        object.setData('fare', Phaser.Math.Between(50, 200));
        
        this.time.delayedCall(4000, () => {
            if (object.active) object.destroy();
        });
        
        this.missionText.setText('মিশন: যাত্রী খুঁজুন!');
    }



    pickUpPassenger(player, passenger) {
        if (!this.isMissionActive && !this.isPenaltyActive) {
            this.isPickingUp = true;
            
            passenger.disableBody(true, true);
            this.physics.pause();
            
            const fare = passenger.getData('fare');
            this.currentFare = fare;
            
            this.missionText.setText(`মিশন: যাত্রী তুলেছে! ভাড়া: ${fare} ৳`);

            this.time.delayedCall(1500, () => {
                this.physics.resume();
                this.isPickingUp = false;
                
                const targetLane = Phaser.Math.RND.pick([-1, 0, 1]);
                const targetX = this.calculateRoadPosition(targetLane);
                const targetY = -config.height * 2; 
                
                this.missionTarget.create(targetX, targetY, 'iso_target')
                    .setScale(0.8)
                    .setVelocityY(RICKSHAW_SPEED) 
                    .setData('fare', fare);
                    
                this.missionText.setText('মিশন: গন্তব্যে পৌঁছান! (' + fare + ' ৳)');
                
            }, [], this);
            this.isMissionActive = true;
        }
    }

    dropOffPassenger(player, target) {
        if (this.isMissionActive && !this.isPenaltyActive) {
            this.isMissionActive = false;
            
            target.disableBody(true, true);
            
            playerMoney += this.currentFare;
            this.moneyText.setText('টাকা: ' + playerMoney + ' ৳');
            
            this.scoreText.setText('ভাড়া: ' + (parseInt(this.scoreText.text.split(': ')[1]) + this.currentFare) + ' টাকা');
            this.currentFare = 0;

            this.physics.pause();
            this.missionText.setText('মিশন সম্পন্ন! পরবর্তী যাত্রীর জন্য প্রস্তুত হন।');
            
            this.time.delayedCall(2000, () => {
                this.physics.resume();
                this.missionText.setText('মিশন: কোনো যাত্রী নেই');
            }, [], this);
        }
    }



    hitObstacle(player, obstacle) {
        const obstacleType = obstacle.getData('type');
        
        if (obstacleType === 'iso_police') {
            this.handlePoliceEncounter(player, obstacle);
            return;
        } 
        
        if (obstacleType === 'iso_pothole') {
            this.handlePotholeHit(player, obstacle);
            return;
        }
        

        this.isGameOver = true;
        this.physics.pause();
        player.setTint(0xff0000); 
        
        this.add.text(config.width / 2, config.height / 2, 
            'গেম ওভার! বাসের সাথে ধাক্কা!\n(R চাপুন)', { 
            fontSize: '40px', fill: '#FFFFFF', backgroundColor: '#FF0000', align: 'center'
        }).setOrigin(0.5).setDepth(2);
    }

    handlePoliceEncounter(player, police) {
        if (this.isPenaltyActive) return;

        this.isPenaltyActive = true;
        police.disableBody(true, true); 
        this.physics.pause(); 
        
        const avoidChance = upgradeLevel.horn * 20; 
        
        if (Phaser.Math.RND.between(1, 100) <= avoidChance) {
            this.add.text(config.width / 2, config.height / 2, 
                'জাদু হর্ন! পুলিশ মামা দেখতেই পায়নি!', { 
                fontSize: '30px', fill: '#00FFFF', backgroundColor: '#000000', align: 'center'
            }).setOrigin(0.5).setDepth(3);

            this.time.delayedCall(1500, () => {
                this.physics.resume();
                this.isPenaltyActive = false;
            }, [], this);
            return; 
        }
        
      
        const penaltyAmount = Phaser.Math.Between(30, 80);
        
        if (playerMoney >= penaltyAmount) {
            playerMoney -= penaltyAmount;
            this.moneyText.setText('টাকা: ' + playerMoney + ' ৳');

            this.add.text(config.width / 2, config.height / 2, 
                `পুলিশে ধরছে! ${penaltyAmount} ৳ জরিমানা!`, { 
                fontSize: '30px', fill: '#FF0000', backgroundColor: '#000000', align: 'center'
            }).setOrigin(0.5).setDepth(3);

        } else {
            this.add.text(config.width / 2, config.height / 2, 
                `জরিমানা দেওয়ার টাকা নাই!\nরিকশা বাজেয়াপ্ত!`, { 
                fontSize: '30px', fill: '#FF0000', backgroundColor: '#000000', align: 'center'
            }).setOrigin(0.5).setDepth(3);
            
            this.isGameOver = true; 
        }
        
        this.time.delayedCall(2000, () => {
            if (!this.isGameOver) {
                this.physics.resume();
                this.isPenaltyActive = false;
            }
        }, [], this);
    }

    handlePotholeHit(player, pothole) {
        pothole.disableBody(true, true); 
        
        let slowDuration = 1000; 
        
        if (upgradeLevel.suspension > 0) {
            slowDuration -= (upgradeLevel.suspension * 200);
            if (slowDuration < 200) slowDuration = 200; 
        }
        
        player.setVelocityY(-RICKSHAW_SPEED / 2); 
        
        this.add.text(config.width / 2, 50, 'উফ! বড় গর্ত!', { 
            fontSize: '20px', fill: '#FFA500', backgroundColor: '#000000'
        }).setOrigin(0.5).setDepth(3);

        this.time.delayedCall(slowDuration, () => {
            player.setVelocityY(0); 
        }, [], this);
    }


    update ()
    {
        if (this.isGameOver) {
            if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
            
                this.scene.start('MenuScene'); 
            }
            return;
        }

        this.road.tilePositionY -= this.roadScrollSpeed; 

        if (this.isMissionActive) {
            this.missionTarget.getChildren().forEach(target => {
                target.y += this.roadScrollSpeed; 
            });
        }
    }
}
