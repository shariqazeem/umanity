/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/umanity.json`.
 */
export type Umanity = {
  "address": "UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3",
  "metadata": {
    "name": "umanity",
    "version": "3.0.0",
    "spec": "0.1.0",
    "description": "Umanity drops: USDC pots that unlock only after a delivery is proven, with refunds and a fixed 50/50 fee split"
  },
  "instructions": [
    {
      "name": "cancelDrop",
      "docs": [
        "Calls a drop off. Its money can then only go back to backers and the fund."
      ],
      "discriminator": [
        78,
        206,
        101,
        116,
        70,
        101,
        44,
        238
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "drop",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "drop.id",
                "account": "drop"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "closeBacker",
      "docs": [
        "After an unlock nobody can be owed a refund, so the record's rent goes",
        "back to whoever paid it. Anyone can call it."
      ],
      "discriminator": [
        179,
        215,
        44,
        252,
        50,
        239,
        29,
        8
      ],
      "accounts": [
        {
          "name": "drop",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "drop.id",
                "account": "drop"
              }
            ]
          }
        },
        {
          "name": "backerRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  99,
                  107,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "account",
                "path": "backer_record.backer",
                "account": "backer"
              }
            ]
          }
        },
        {
          "name": "rentPayer",
          "writable": true,
          "relations": [
            "backerRecord"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "createDrop",
      "docs": [
        "`meta_hash` is the sha256 of the drop's public description (place,",
        "shopping list, prices), so the page can prove it was never edited."
      ],
      "discriminator": [
        157,
        142,
        145,
        247,
        92,
        73,
        59,
        48
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "drop",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "config.drop_count",
                "account": "config"
              }
            ]
          }
        },
        {
          "name": "pot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "goal",
          "type": "u64"
        },
        {
          "name": "cap",
          "type": "u64"
        },
        {
          "name": "deadline",
          "type": "i64"
        },
        {
          "name": "payee",
          "type": "pubkey"
        },
        {
          "name": "metaHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "fundDrop",
      "docs": [
        "Moves money the drops fund holds into a pot."
      ],
      "discriminator": [
        52,
        44,
        245,
        128,
        233,
        23,
        234,
        36
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "drop",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "drop.id",
                "account": "drop"
              }
            ]
          }
        },
        {
          "name": "pot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "dropsFund",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "usdcMint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "give",
      "docs": [
        "Gives `amount` USDC from the giver's account. `backer` is who gets a",
        "refund if the drop doesn't happen: usually the giver, or the real",
        "person behind a relayed gift (an agent paying over x402, a gift that",
        "arrived from another chain). `payer` covers the record's rent, so a",
        "sponsor can pay it for people with no SOL."
      ],
      "discriminator": [
        220,
        72,
        114,
        72,
        68,
        33,
        116,
        204
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "drop",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "drop.id",
                "account": "drop"
              }
            ]
          }
        },
        {
          "name": "pot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "backerRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  99,
                  107,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "arg",
                "path": "backer"
              }
            ]
          }
        },
        {
          "name": "source",
          "writable": true
        },
        {
          "name": "giver",
          "signer": true
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "usdcMint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "backer",
          "type": "pubkey"
        },
        {
          "name": "giftRef",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        }
      ]
    },
    {
      "name": "giveAll",
      "docs": [
        "Gives everything in the source account above `keep`, up to what the",
        "pot has room for. Built for execute-on-arrival flows (Aurora Intents",
        "Connect): the intermediary that received a cross-chain payout calls it",
        "without knowing the exact amount. The backer record must already be",
        "open (`open_backer`), so the intermediary needs no SOL."
      ],
      "discriminator": [
        175,
        149,
        89,
        47,
        196,
        45,
        48,
        18
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "drop",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "drop.id",
                "account": "drop"
              }
            ]
          }
        },
        {
          "name": "pot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "backerRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  99,
                  107,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "account",
                "path": "backer_record.backer",
                "account": "backer"
              }
            ]
          }
        },
        {
          "name": "source",
          "writable": true
        },
        {
          "name": "giver",
          "signer": true
        },
        {
          "name": "usdcMint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "keep",
          "type": "u64"
        },
        {
          "name": "giftRef",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        }
      ]
    },
    {
      "name": "initConfig",
      "docs": [
        "One-time setup, signed by the program's upgrade authority so nobody",
        "can claim a fresh deployment first."
      ],
      "discriminator": [
        23,
        235,
        115,
        232,
        168,
        96,
        1,
        231
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "fees",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "feeInbox",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "fees"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "dropsFund",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint"
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "program",
          "address": "UmauiNGcoKaL8RS6iXfGRJZ2669EghdqUTNsRFge1H3"
        },
        {
          "name": "programData"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "releaseAuthority",
          "type": "pubkey"
        },
        {
          "name": "ops",
          "type": "pubkey"
        },
        {
          "name": "maxPot",
          "type": "u64"
        },
        {
          "name": "reviewSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "lockReleaseAuthority",
      "docs": [
        "One-way: after this, not even the admin can change who unlocks pots."
      ],
      "discriminator": [
        188,
        101,
        76,
        97,
        105,
        49,
        23,
        61
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": []
    },
    {
      "name": "openBacker",
      "docs": [
        "Opens an empty backer record so a later `give_all` needs no rent."
      ],
      "discriminator": [
        239,
        108,
        246,
        15,
        10,
        215,
        25,
        81
      ],
      "accounts": [
        {
          "name": "drop",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "drop.id",
                "account": "drop"
              }
            ]
          }
        },
        {
          "name": "backerRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  99,
                  107,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "arg",
                "path": "backer"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "backer",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "postProof",
      "docs": [
        "The field team posts the hash of the proof bundle (video, photos,",
        "receipts). Gifts close and the review window starts. Posting again",
        "replaces the hash and restarts the window."
      ],
      "discriminator": [
        112,
        117,
        74,
        221,
        176,
        119,
        95,
        28
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "drop",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "drop.id",
                "account": "drop"
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "proofHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "refund",
      "docs": [
        "Sends a backer everything they gave, once refunds are open. Anyone can",
        "call it, and the money can only go to the backer, so Umanity can send",
        "every refund without anyone having to ask."
      ],
      "discriminator": [
        2,
        96,
        183,
        251,
        63,
        208,
        46,
        46
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "drop",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "drop.id",
                "account": "drop"
              }
            ]
          }
        },
        {
          "name": "pot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "backerRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  98,
                  97,
                  99,
                  107,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "account",
                "path": "backer"
              }
            ]
          }
        },
        {
          "name": "backer"
        },
        {
          "name": "backerUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "backer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "rentPayer",
          "writable": true,
          "relations": [
            "backerRecord"
          ]
        },
        {
          "name": "usdcMint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "returnToFund",
      "docs": [
        "Once refunds are open, returns everything in the pot that isn't owed",
        "to a backer (fund money, plain transfers) to the drops fund."
      ],
      "discriminator": [
        226,
        14,
        9,
        28,
        111,
        240,
        142,
        199
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "drop",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "drop.id",
                "account": "drop"
              }
            ]
          }
        },
        {
          "name": "pot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "dropsFund",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "setAdmin",
      "discriminator": [
        251,
        163,
        0,
        52,
        91,
        194,
        187,
        92
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "admin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "setParams",
      "discriminator": [
        27,
        234,
        178,
        52,
        147,
        2,
        187,
        141
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "ops",
          "type": "pubkey"
        },
        {
          "name": "maxPot",
          "type": "u64"
        },
        {
          "name": "reviewSecs",
          "type": "i64"
        }
      ]
    },
    {
      "name": "setReleaseAuthority",
      "docs": [
        "Hands unlock rights to a new key (later: an address NEAR's Chain",
        "Signatures controls). Refused once `lock_release_authority` ran."
      ],
      "discriminator": [
        198,
        64,
        247,
        169,
        134,
        118,
        223,
        176
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true,
          "relations": [
            "config"
          ]
        }
      ],
      "args": [
        {
          "name": "releaseAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "splitFees",
      "docs": [
        "Splits whatever USDC is in the fee inbox: half to the drops fund,",
        "half to ops. Anyone can call it."
      ],
      "discriminator": [
        245,
        141,
        31,
        22,
        164,
        226,
        232,
        158
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "fees",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "feeInbox",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "fees"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "dropsFund",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "ops",
          "relations": [
            "config"
          ]
        },
        {
          "name": "opsUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ops"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usdcMint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "sweepMeteoraFees",
      "docs": [
        "Claims $UMANITY trading fees from Meteora into the fee inbox, then",
        "splits them. Our `fees` address is the pool config's fee claimer, so",
        "this program is the only thing that can claim them. Anyone can call it."
      ],
      "discriminator": [
        5,
        101,
        154,
        39,
        215,
        4,
        123,
        189
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "fees",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  101,
                  101,
                  115
                ]
              }
            ]
          }
        },
        {
          "name": "feeInbox",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "fees"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "feesBase",
          "docs": [
            "Receives any base-token fees (none when the pool collects fees in USDC)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "fees"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "baseMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "dropsFund",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "config"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "ops",
          "relations": [
            "config"
          ]
        },
        {
          "name": "opsUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "ops"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "dbcConfig"
        },
        {
          "name": "dbcPool",
          "writable": true
        },
        {
          "name": "baseVault",
          "writable": true
        },
        {
          "name": "quoteVault",
          "writable": true
        },
        {
          "name": "baseMint"
        },
        {
          "name": "dbcPoolAuthority",
          "address": "FhVo3mqL8PW5pH5U2CN4XE33DokiyZnUwuGpH2hmHLuM"
        },
        {
          "name": "dbcEventAuthority",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  95,
                  95,
                  101,
                  118,
                  101,
                  110,
                  116,
                  95,
                  97,
                  117,
                  116,
                  104,
                  111,
                  114,
                  105,
                  116,
                  121
                ]
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                9,
                96,
                12,
                165,
                36,
                247,
                177,
                183,
                214,
                204,
                177,
                195,
                151,
                58,
                160,
                51,
                13,
                25,
                3,
                218,
                96,
                28,
                201,
                181,
                222,
                227,
                198,
                98,
                180,
                202,
                209,
                73
              ]
            }
          }
        },
        {
          "name": "dbcProgram",
          "address": "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN"
        },
        {
          "name": "usdcMint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "maxBase",
          "type": "u64"
        },
        {
          "name": "maxQuote",
          "type": "u64"
        }
      ]
    },
    {
      "name": "unlock",
      "docs": [
        "Pays the whole pot to the drop's payee."
      ],
      "discriminator": [
        101,
        155,
        40,
        21,
        158,
        189,
        56,
        203
      ],
      "accounts": [
        {
          "name": "config",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "drop",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  100,
                  114,
                  111,
                  112
                ]
              },
              {
                "kind": "account",
                "path": "drop.id",
                "account": "drop"
              }
            ]
          }
        },
        {
          "name": "pot",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "drop"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "payee"
        },
        {
          "name": "payeeUsdc",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "payee"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "releaseAuthority",
          "signer": true,
          "relations": [
            "config"
          ]
        },
        {
          "name": "usdcMint",
          "relations": [
            "config"
          ]
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "backer",
      "discriminator": [
        199,
        128,
        179,
        190,
        2,
        66,
        118,
        252
      ]
    },
    {
      "name": "config",
      "discriminator": [
        155,
        12,
        170,
        224,
        30,
        250,
        204,
        130
      ]
    },
    {
      "name": "drop",
      "discriminator": [
        56,
        174,
        80,
        200,
        182,
        146,
        223,
        35
      ]
    }
  ],
  "events": [
    {
      "name": "configSet",
      "discriminator": [
        15,
        104,
        59,
        16,
        236,
        241,
        8,
        6
      ]
    },
    {
      "name": "dropCancelled",
      "discriminator": [
        30,
        235,
        60,
        246,
        202,
        91,
        101,
        237
      ]
    },
    {
      "name": "dropCreated",
      "discriminator": [
        179,
        166,
        43,
        166,
        63,
        69,
        138,
        46
      ]
    },
    {
      "name": "feesSplit",
      "discriminator": [
        184,
        151,
        122,
        249,
        135,
        3,
        6,
        129
      ]
    },
    {
      "name": "fundedDrop",
      "discriminator": [
        58,
        11,
        158,
        225,
        205,
        81,
        97,
        234
      ]
    },
    {
      "name": "gave",
      "discriminator": [
        174,
        33,
        100,
        214,
        93,
        149,
        254,
        71
      ]
    },
    {
      "name": "meteoraFeesClaimed",
      "discriminator": [
        224,
        90,
        101,
        71,
        221,
        90,
        131,
        174
      ]
    },
    {
      "name": "proofPosted",
      "discriminator": [
        190,
        150,
        224,
        156,
        238,
        39,
        246,
        39
      ]
    },
    {
      "name": "refunded",
      "discriminator": [
        35,
        103,
        149,
        246,
        196,
        123,
        221,
        99
      ]
    },
    {
      "name": "returnedToFund",
      "discriminator": [
        190,
        51,
        174,
        204,
        168,
        236,
        170,
        245
      ]
    },
    {
      "name": "unlocked",
      "discriminator": [
        219,
        104,
        74,
        123,
        174,
        92,
        182,
        120
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "unauthorized",
      "msg": "Not allowed"
    },
    {
      "code": 6001,
      "name": "invalidParams",
      "msg": "Invalid parameters"
    },
    {
      "code": 6002,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6003,
      "name": "dropClosed",
      "msg": "This drop is no longer taking gifts"
    },
    {
      "code": 6004,
      "name": "potFull",
      "msg": "This pot is full"
    },
    {
      "code": 6005,
      "name": "notProven",
      "msg": "No proof has been posted"
    },
    {
      "code": 6006,
      "name": "inReview",
      "msg": "The review window is still open"
    },
    {
      "code": 6007,
      "name": "unlockWindowClosed",
      "msg": "The unlock window has closed"
    },
    {
      "code": 6008,
      "name": "refundsNotOpen",
      "msg": "Refunds are not open for this drop"
    },
    {
      "code": 6009,
      "name": "nothingToRefund",
      "msg": "Nothing to refund"
    },
    {
      "code": 6010,
      "name": "nothingToReturn",
      "msg": "Nothing to return"
    },
    {
      "code": 6011,
      "name": "nothingToSplit",
      "msg": "The fee inbox is empty"
    },
    {
      "code": 6012,
      "name": "releaseLocked",
      "msg": "The release authority is locked"
    },
    {
      "code": 6013,
      "name": "deadlinePassed",
      "msg": "The drop's date has passed"
    },
    {
      "code": 6014,
      "name": "alreadyFinal",
      "msg": "This drop is already unlocked or cancelled"
    },
    {
      "code": 6015,
      "name": "wrongPayee",
      "msg": "Not the drop's payee"
    },
    {
      "code": 6016,
      "name": "dropNotFinished",
      "msg": "The drop is not finished"
    },
    {
      "code": 6017,
      "name": "mathOverflow",
      "msg": "Math overflow"
    }
  ],
  "types": [
    {
      "name": "backer",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "drop",
            "type": "pubkey"
          },
          {
            "name": "backer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "gifts",
            "type": "u32"
          },
          {
            "name": "rentPayer",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "config",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "releaseAuthority",
            "type": "pubkey"
          },
          {
            "name": "releaseLocked",
            "type": "bool"
          },
          {
            "name": "ops",
            "type": "pubkey"
          },
          {
            "name": "usdcMint",
            "type": "pubkey"
          },
          {
            "name": "maxPot",
            "docs": [
              "Most a single pot can hold (USDC base units)."
            ],
            "type": "u64"
          },
          {
            "name": "reviewSecs",
            "docs": [
              "Seconds between posting proof and the earliest unlock."
            ],
            "type": "i64"
          },
          {
            "name": "dropCount",
            "type": "u64"
          },
          {
            "name": "feesSplit",
            "docs": [
              "Lifetime totals, so the Money page can check them against the chain."
            ],
            "type": "u64"
          },
          {
            "name": "fundIn",
            "type": "u64"
          },
          {
            "name": "fundOut",
            "type": "u64"
          },
          {
            "name": "fundBack",
            "type": "u64"
          },
          {
            "name": "opsOut",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "feesBump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "configSet",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "releaseAuthority",
            "type": "pubkey"
          },
          {
            "name": "releaseLocked",
            "type": "bool"
          },
          {
            "name": "ops",
            "type": "pubkey"
          },
          {
            "name": "maxPot",
            "type": "u64"
          },
          {
            "name": "reviewSecs",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "drop",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "payee",
            "type": "pubkey"
          },
          {
            "name": "goal",
            "type": "u64"
          },
          {
            "name": "cap",
            "type": "u64"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "metaHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "state",
            "docs": [
              "0 open, 1 proven, 2 unlocked, 3 cancelled"
            ],
            "type": "u8"
          },
          {
            "name": "given",
            "docs": [
              "Recorded gifts (refundable to their backers)."
            ],
            "type": "u64"
          },
          {
            "name": "fromFund",
            "type": "u64"
          },
          {
            "name": "refunded",
            "type": "u64"
          },
          {
            "name": "returned",
            "type": "u64"
          },
          {
            "name": "backers",
            "type": "u32"
          },
          {
            "name": "gifts",
            "type": "u32"
          },
          {
            "name": "proofHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "proofAt",
            "type": "i64"
          },
          {
            "name": "unlocked",
            "type": "u64"
          },
          {
            "name": "unlockedAt",
            "type": "i64"
          },
          {
            "name": "cancelledAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "dropCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "drop",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "dropCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "drop",
            "type": "pubkey"
          },
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "goal",
            "type": "u64"
          },
          {
            "name": "cap",
            "type": "u64"
          },
          {
            "name": "deadline",
            "type": "i64"
          },
          {
            "name": "payee",
            "type": "pubkey"
          },
          {
            "name": "metaHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    },
    {
      "name": "feesSplit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "total",
            "type": "u64"
          },
          {
            "name": "toDrops",
            "type": "u64"
          },
          {
            "name": "toOps",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "fundedDrop",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "drop",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "potAfter",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "gave",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "drop",
            "type": "pubkey"
          },
          {
            "name": "backer",
            "type": "pubkey"
          },
          {
            "name": "giver",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "potAfter",
            "type": "u64"
          },
          {
            "name": "giftRef",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          }
        ]
      }
    },
    {
      "name": "meteoraFeesClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pool",
            "type": "pubkey"
          },
          {
            "name": "quote",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "proofPosted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "drop",
            "type": "pubkey"
          },
          {
            "name": "proofHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "reviewEnds",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "refunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "drop",
            "type": "pubkey"
          },
          {
            "name": "backer",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "returnedToFund",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "drop",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "unlocked",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "drop",
            "type": "pubkey"
          },
          {
            "name": "payee",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "proofHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          }
        ]
      }
    }
  ]
};
