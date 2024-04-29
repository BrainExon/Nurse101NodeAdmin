class NftImage {
  constructor(imageId, nftId, name, date, owner, url, version) {
    this.imageId = imageId;
    this.nftId = nftId;
    this.name = name;
    this.date = date;
    this.owner = owner;
    this.url = url;
    this.version = version;
  }
}

module.exports = NftImage;
