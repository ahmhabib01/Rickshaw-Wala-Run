// গেমের কনফিগারেশন
const config = {
    type: Phaser.AUTO,
    width: 480, // একটি মোবাইল স্ক্রিনের মতো সাইজ
    height: 720,
    physics: {
        default: 'arcade',
        arcade: {
            // debug: true, // চাইলে Physics বডি দেখতে পারেন
            gravity: { y: 0 } // 2D টপ-ডাউন রানার গেমের জন্য কোনো গ্র্যাভিটি লাগবে না
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let rickshawala; // আমাদের প্রধান চরিত্র
let cursors; // ইনপুট কন্ট্রোল

function preload ()
{
    // *** অ্যাসেট লোডিং এর জায়গা (Placeholder ব্যবহার করা হলো) ***
    // রিকশাওয়ালা (একটি সাধারণ বক্স)
    this.load.image('rickshawala', 'assets/rickshaw.png'); // ভবিষ্যতে আপনার দেওয়া গ্রাফিক্স এখানে লোড হবে
    // রাস্তার ব্যাকগ্রাউন্ড (একটি সাধারণ ইমেজ)
    this.load.image('road', 'assets/road_tile.png'); // ভবিষ্যতে আপনার দেওয়া গ্রাফিক্স এখানে লোড হবে
}

function create ()
{
    // ১. চলমান রাস্তার ব্যাকগ্রাউন্ড তৈরি করা
    // road (tileSprite) ব্যবহার করা হলো যাতে এটি চলন্ত মনে হয়
    this.road = this.add.tileSprite(config.width / 2, config.height / 2, config.width, config.height, 'road');
    // আমি ধরে নিচ্ছি 'road' অ্যাসেটটি দেখতে নতুন ঢাকার রাস্তার মতো
    
    // ২. রিকশাওয়ালাকে স্ক্রিনের নিচে মাঝখানে যুক্ত করা
    // আপাতত একটি প্লেসহোল্ডার হিসেবে সাদা বক্স বা টেম্পোরারি ইমেজ ধরে নেওয়া হলো
    rickshawala = this.physics.add.sprite(config.width / 2, config.height - 100, 'rickshawala');
    
    // রিকশাওয়ালার স্কেল ছোট করা (প্রয়োজনে অ্যাডজাস্ট করা হবে)
    rickshawala.setScale(0.7); 
    
    // রিকশাওয়ালাকে গেম এরিয়ার মধ্যে আটকে রাখা
    rickshawala.setCollideWorldBounds(true); 

    // ৩. কীবোর্ড ইনপুট সেটআপ করা
    cursors = this.input.keyboard.createCursorKeys();
}

function update ()
{
    // ১. রাস্তা সচল রাখা (ব্যাকগ্রাউন্ড স্ক্রলিং)
    // প্রতি ফ্রেমে রাস্তাটি নিচের দিকে স্ক্রল করবে, ফলে রিকশাটি চলন্ত মনে হবে
    this.road.tilePositionY -= 5; 
    
    // ২. রিকশাওয়ালা মুভমেন্ট
    rickshawala.setVelocity(0);

    if (cursors.left.isDown)
    {
        // বাম দিকে সরান
        rickshawala.setVelocityX(-200);
    }
    else if (cursors.right.isDown)
    {
        // ডান দিকে সরান
        rickshawala.setVelocityX(200);
    }
    // রিকশাওয়ালা রানার গেম, তাই সে নিজে থেকেই সামনে চলতে থাকবে, শুধু ডানে-বামে সরবে।
    // আপাতত Up/Down মুভমেন্ট বন্ধ রাখছি, কেবল লেন চেঞ্জ করার জন্য ডানে-বামে সরবে।
}

// এই কোডটি রান করার জন্য আপনাকে 'assets' ফোল্ডারে 'rickshaw.png' এবং 'road_tile.png' নামে দুটি টেম্পোরারি ইমেজ রাখতে হবে। 
// যেহেতু আমি রিয়াল গ্রাফিক্স তৈরি করতে পারি না, তাই আপনাকে এখন এই অ্যাসেটগুলোর placeholder ইমেজ দিয়ে প্রজেক্ট শুরু করতে হবে।
// এরপর আমরা ট্র্যাফিক (বাধা) ও স্কোরিং যুক্ত করব।
