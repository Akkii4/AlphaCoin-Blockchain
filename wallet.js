const EC=require('elliptic').ec;
const ec=new EC("secp256k1");  //it is a parameter of elliptic curve which Bitcoin uses standards of efficient cryptography prime 256 bits(32 byte long prime no. for generating the ellipic curve)
var Base58 = require('base58');
var RIPEMD160 = require('ripemd160');
var sha256 = require("sha256");
function Wallet()
{
	this.Balance=100;	//providing each wallet with 100 Alpha coins
	this.keyPair=ec.genKeyPair();	//private and public key pair
	this.publicKey=this.keyPair.getPublic().encode('hex');	//fetching the public key from the key pair and encoding it in hex format for human readable type
	this.privateKey=this.keyPair.getPrivate().toString('hex');	
	this.publicAddress=Base58.encode(0x00)+new RIPEMD160().update(sha256(0x00+this.publicKey).toString()).digest('hex');
	this.Transactions=[];	//all transactions done via this wallet
//public address is generated by Base58.encode(bitcoinversion)+RIPEMD160(sha256(publicKey))
}

// retriving  keypair  from the private key
Wallet.prototype.keyFromPrivate=function(privatekey)
{
	return ec.keyFromPrivate(privatekey);
};


// retriving  keypair  from the public key
Wallet.prototype.keyFromPublic=function(publickey)
{
	return ec.keyFromPublic(publickey,'hex');
};



Wallet.prototype.firstWallet=function()
{
return {                              //generated wallet data
        PublicAddress:"15c0e01ca1ce0e6a99268cd98688d74a65b20958d",
        PrivateKeyHash:"d9095010746be00df4a23be1356acde1c2a8de480e4285923453787c47cb5002",
        Balance:0,
        Transactions:[]
        };
}
module.exports=Wallet;

