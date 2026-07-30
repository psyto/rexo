# Context Capital

AI が実行した仕事の「生プロンプト」ではなく、**実行の文脈（何を見て、どのツールをどう使い、どんな制約下で、どれだけ良い結果を出したか）**を、秘密を守ったまま検証可能な信用として持ち運べるプロダクト。

**MVP の背骨は「検証可能な実行実績・信用レイヤー（柱2）」**。最初の対象は AI 支援の Web 制作。制作者の完了案件から、顧客の秘密を出さずに、独立検証者が再計算した Proof Receipt を発行し、第三者がその主張を再現検証できるようにする。

再利用スキルのロイヤリティ市場（柱1）は信用が成立した後に上へ接ぐ。将来計算資源への与信（柱3）は MVP 外。

## Documents

- **[Credential-layer MVP（現行の背骨・v0.2）](docs/00-credential-layer-mvp.md)** ← まずこれ
- [Product requirements（v0.1・柱1 framing／00 が背骨を差し替え）](docs/01-product-requirements.md)
- [Technical requirements](docs/02-technical-requirements.md)
- [AI development guide](docs/03-ai-development-guide.md)
- [Implementation plan（v0.1・00 §8 が現行 phase plan）](docs/04-implementation-plan.md)

## MVP boundary

MVP は「収益を約束する金融商品」でも「マーケットプレイス」でもない。**供給側が実績を検証可能にする信用レイヤー**として検証する。二面流動性を要求しないのでコールドスタートを負わない。投資、売買可能トークン、信用供与、予測市場、エスクロー / ロイヤリティ決済は MVP に含めない。
