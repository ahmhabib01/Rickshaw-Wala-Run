// গেমের কনফিগারেশন (আগের মতোই)
const config = {
    type: Phaser.AUTO,
    width: 480,
    height: 720,
    physics: {
        default: 'arcade',
        arcade: {
            // debug: true, 
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let rickshawala;
let cursors;
let score = 0; // মোট স্কোর (ভাড়া)
let scoreText;
let obstacles; // বাধার জন্য গ্রুপ
let passengers; // যাত্রীদের জন্য গ্রুপ
let isPickingUp = false; // যাত্রী তোলার জন্য ফ্ল্যাগ
let currentFare = 0; // যাত্রীর জন্য বরাদ্দ ভাড়া

function preload ()
{
    // অ্যাসেট লোডিং (আপনাকে এই প্লেসহোল্ডার ইমেজগুলো রাখতে হবে)
    this.load.image('rickshawala', 'assets/rickshaw.png');
    this.load.image('road', 'assets/road_tile.png');
    
    // বাধার প্লেসহোল্ডার
    this.load.image('vip_car', 'assets/vip_car.png');
    this.load.image('bus', 'assets/bus.png');
    this.load.image('bike', 'assets/bike.png'); // উল্টো পথে বাইক
    
    // যাত্রীর প্লেসহোল্ডার
    this.load.image('passenger', 'assets/passenger.png'); // দাঁড়িয়ে থাকা যাত্রী
    
    // পাওয়ার-আপ প্লেসহোল্ডার
    this.load.image('tea', 'assets/tea.png'); // ঝটপট চা
}

function create ()
{
    // ১. রাস্তা সেটআপ
    this.road = this.add.tileSprite(config.width / 2, config.height / 2, config.width, config.height, 'road');
    
    // ২. রিকশাওয়ালা সেটআপ
    rickshawala = this.physics.add.sprite(config.width / 2, config.height - 100, 'rickshawala');
    rickshawala.setScale(0.7); 
    rickshawala.setCollideWorldBounds(true); 

    // ৩. কীবোর্ড ইনপুট সেটআপ
    cursors = this.input.keyboard.createCursorKeys();
    
    // ৪. স্কোর টেক্সট সেটআপ
    scoreText = this.add.text(10, 10, 'ভাড়া: 0 টাকা', { fontSize: '24px', fill: '#FFD700', backgroundColor: '#000000' });
    
    // ৫. অবজেক্ট গ্রুপ তৈরি (বাধা ও যাত্রী)
    obstacles = this.physics.add.group();
    passengers = this.physics.add.group();
    
    // ৬. অবজেক্ট স্পনিং এর জন্য টাইমার
    this.time.addEvent({
        delay: 1500, // প্রতি 1.5 সেকেন্ড পর পর একটি করে অবজেক্ট তৈরি হবে
        callback: spawnObject,
        callbackScope: this,
        loop: true
    });
    
    // ৭. কোলিশন সেটআপ
    // রিকশাওয়ালা ও বাধার মধ্যে ধাক্কা লাগলে gameOver ফাংশন কল হবে
    this.physics.add.collider(rickshawala, obstacles, hitObstacle, null, this);
    
    // ৮. রিকশাওয়ালা ও যাত্রীর মধ্যে ওভারল্যাপ হলে (পিক-আপ)
    this.physics.add.overlap(rickshawala, passengers, pickUpPassenger, null, this);
}

// এই ফাংশনটি প্রতি 1.5 সেকেন্ড পর পর নতুন অবজেক্ট তৈরি করবে
function spawnObject() {
    // স্ক্রিনের র্যান্ডম X পজিশন
    const x = Phaser.Math.Between(50, config.width - 50);
    const y = -50; // স্ক্রিনের বাইরে থেকে আসবে
    let object;

    // 25% চান্স যাত্রী, 75% চান্স বাধা
    if (Math.random() < 0.25 && !isPickingUp) { 
        // যাত্রী তৈরি
        object = passengers.create(x, y, 'passenger');
        currentFare = Phaser.Math.Between(50, 150); // যাত্রীর ভাড়া র্যান্ডমলি ঠিক করা
    } else {
        // বাধা তৈরি
        const obstacleType = Phaser.Math.RND.pick(['vip_car', 'bus', 'bike']);
        object = obstacles.create(x, y, obstacleType);
    }
    
    object.setScale(0.6); // স্কেল অ্যাডজাস্ট করা
    object.setVelocityY(200); // নিচের দিকে চলতে থাকবে (রিকশা চলছে)
    
    // অবজেক্টটি যখন স্ক্রিনের বাইরে চলে যাবে, তখন এটি ধ্বংস হয়ে যাবে
    this.time.delayedCall(4000, () => {
        if (object.active) object.destroy();
    });
}

// রিকশাওয়ালা বাধার সাথে ধাক্কা খেলে
function hitObstacle(player, obstacle) {
    // খেলা বন্ধ করা
    this.physics.pause();
    
    // রিকশাওয়ালা লাল হয়ে যাবে (ফানি এফেক্ট)
    player.setTint(0xff0000); 
    
    // গেম ওভার টেক্সট
    this.add.text(config.width / 2, config.height / 2, 'গেম ওভার!\nবাস ধাক্কা খাইছে!', { 
        fontSize: '48px', 
        fill: '#FFFFFF',
        backgroundColor: '#FF0000'
    }).setOrigin(0.5);
}

// রিকশাওয়ালা যাত্রী তুললে
function pickUpPassenger(player, passenger) {
    if (!isPickingUp) {
        isPickingUp = true;
        
        // ১. যাত্রী অদৃশ্য হয়ে যাবে (রিকশায় উঠে গেছে)
        passenger.disableBody(true, true);
        
        // ২. রিকশাওয়ালাকে কিছুক্ষণের জন্য থামাতে হবে (পিক-আপ লজিক)
        player.setVelocity(0); // রিকশা থামবে
        
        // ৩. ফানি মেসেজ
        this.add.text(config.width / 2, config.height / 2 - 50, `যাত্রী উঠাইছেন! ভাড়া: ${currentFare} টাকা`, { 
            fontSize: '20px', 
            fill: '#00FF00',
            backgroundColor: '#000000'
        }).setOrigin(0.5);

        // ৪. ৩ সেকেন্ড পর আবার খেলা শুরু
        this.time.delayedCall(3000, () => {
            isPickingUp = false;
            // স্কোর যুক্ত করা
            score += currentFare;
            scoreText.setText('ভাড়া: ' + score + ' টাকা');
            currentFare = 0;
        }, [], this);
    }
}

function update ()
{
    // ১. রাস্তা সচল রাখা
    this.road.tilePositionY -= 5; 
    
    // ২. রিকশাওয়ালা মুভমেন্ট
    rickshawala.setVelocity(0);

    // যাত্রী তোলার সময় রিকশা মুভ করবে না
    if (!isPickingUp) {
        if (cursors.left.isDown)
        {
            rickshawala.setVelocityX(-200);
        }
        else if (cursors.right.isDown)
        {
            rickshawala.setVelocityX(200);
        }
    }
}
