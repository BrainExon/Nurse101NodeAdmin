class CreatedItem {
  constructor({ type, entityName, entityId, dataTxId, metadataTxId, bundledIn, sourceUri }) {
    this.type = type;
    this.entityName = entityName;
    this.entityId = entityId;
    this.dataTxId = dataTxId;
    this.metadataTxId = metadataTxId;
    this.bundledIn = bundledIn;
    this.sourceUri = sourceUri;
  }
}

class TipsItem {
  constructor({ recipient, txId, winston }) {
    this.recipient = recipient;
    this.txId = txId;
    this.winston = winston;
  }
}

class NFTData {
  constructor({ created, tips, fees }) {
    this.created = created;
    this.tips = tips;
    this.fees = fees;
  }
}

class Nft {
  constructor({ nftId, data }) {
    this.nftId = nftId;
    this.created = data.created;
    this.tips = data.tips;
    this.fees = data.fees;
  }
}

module.exports = Nft;
