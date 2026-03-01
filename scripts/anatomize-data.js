window.ANATOMIZE_IMAGES = [
  {
    id: 'pelvic_outlet',
    label: 'Pelvic Outlet',
    mechanic: 'blank_panels',
    imageSrc: 'img/PRI-1-Pelvic-Outlet2.jpg',
    structures: [
      {
        id: 'obturator_internus',
        label: 'Obturator Internus (L)',
        type: 'muscle',
        priColor: '--pri-green-family',
        panelBox: {x: 0, y: 20, w: 14, h: 5},
        arrowTo: {x: 22, y: 34},
        polygon: [
          [17, 24], [24, 20], [28, 24], [28, 32],
          [26, 38], [22, 42], [17, 40], [15, 34]
        ],
        priDetail: {
          layer1: {
            standard: 'Femoral ER (open-chain), pelvic diaphragm ascension (closed-chain).',
            pri: 'Key corrective \u2014 L IsP ER (outlet abduction). Pulls ischium laterally in closed chain.',
            chain: 'Pelvic floor \u2014 deep interior chain'
          },
          layer2: {
            laic: 'L obturator internus \u2192 L IsP ER. Opens left outlet, ascends pelvic diaphragm. THE key corrective muscle.'
          },
          layer3: {
            treatment: 'Step 2: L obturator internus + L pelvic floor. HALT 1/5 \u2192 2/5.'
          }
        }
      },
      {
        id: 'obturator_internus_r',
        label: 'Obturator Internus (R)',
        type: 'muscle',
        priColor: '--pri-green-family',
        panelBox: {x: 86, y: 20, w: 14, h: 5},
        arrowTo: {x: 78, y: 34},
        polygon: [
          [72, 24], [76, 20], [83, 24], [85, 34],
          [83, 40], [78, 42], [72, 38], [72, 32]
        ],
        priDetail: {
          layer1: {
            standard: 'Femoral ER (open-chain), pelvic diaphragm ascension (closed-chain).',
            pri: 'Key corrective \u2014 L IsP ER (outlet abduction). Pulls ischium laterally in closed chain.',
            chain: 'Pelvic floor \u2014 deep interior chain'
          },
          layer2: {
            laic: 'L obturator internus \u2192 L IsP ER. Opens left outlet, ascends pelvic diaphragm. THE key corrective muscle.'
          },
          layer3: {
            treatment: 'Step 2: L obturator internus + L pelvic floor. HALT 1/5 \u2192 2/5.'
          }
        }
      },
      {
        id: 'iliococcygeus',
        label: 'Iliococcygeus',
        type: 'muscle',
        priColor: '--pri-green-family',
        panelBox: {x: 0, y: 36, w: 14, h: 5},
        arrowTo: {x: 33, y: 44},
        polygon: [
          [26, 38], [34, 36], [40, 40], [42, 46],
          [40, 52], [34, 54], [28, 50], [24, 44]
        ],
        priDetail: {
          layer1: {
            standard: 'Pelvic floor support, coccyx stabilization.',
            pri: 'Part of pelvic diaphragm. Assists outlet abduction with obturator internus.',
            chain: 'Pelvic floor \u2014 frontal plane'
          },
          layer2: {
            laic: 'Works with obturator internus for L pelvic diaphragm ascension.'
          },
          layer3: {
            treatment: 'Facilitated alongside obturator internus in pelvic floor activities.'
          }
        }
      },
      {
        id: 'pubococcygeus',
        label: 'Pubococcygeus',
        type: 'muscle',
        priColor: '--pri-brown',
        panelBox: {x: 0, y: 12, w: 14, h: 5},
        arrowTo: {x: 42, y: 22},
        polygon: [
          [38, 14], [44, 12], [52, 12], [58, 14],
          [58, 22], [54, 28], [48, 30], [42, 28],
          [38, 22]
        ],
        priDetail: {
          layer1: {
            standard: 'Pelvic floor support, urinary/fecal continence.',
            pri: 'Sagittal plane pelvic floor component. Assists posterior pelvic tilt.',
            chain: 'Pelvic floor \u2014 sagittal plane'
          },
          layer2: {
            laic: 'Assists sagittal correction of pelvic position.'
          },
          layer3: {
            treatment: 'Indirectly facilitated through 90-90 hip lift and pelvic floor integration.'
          }
        }
      },
      {
        id: 'puborectalis',
        label: 'Puborectalis',
        type: 'muscle',
        priColor: '--pri-brown',
        panelBox: {x: 86, y: 28, w: 14, h: 5},
        arrowTo: {x: 52, y: 38},
        polygon: [
          [40, 32], [48, 30], [56, 32], [60, 38],
          [58, 44], [52, 46], [44, 44], [40, 38]
        ],
        priDetail: {
          layer1: {
            standard: 'Maintains anorectal angle, fecal continence.',
            pri: 'Sagittal plane muscle. U-shaped sling around rectum.',
            chain: 'Pelvic floor \u2014 sagittal'
          },
          layer2: {
            laic: 'Part of sagittal pelvic floor restoration.'
          },
          layer3: {
            treatment: 'Restored through comprehensive pelvic floor activities.'
          }
        }
      },
      {
        id: 'medial_hamstring',
        label: 'Medial Hamstring',
        type: 'muscle',
        priColor: '--pri-brown',
        panelBox: {x: 86, y: 12, w: 14, h: 5},
        arrowTo: {x: 78, y: 18},
        polygon: [
          [74, 14], [80, 12], [84, 16], [84, 22],
          [80, 24], [76, 22], [74, 18]
        ],
        priDetail: {
          layer1: {
            standard: 'Hip extension, knee flexion, tibial IR.',
            pri: 'L hamstrings assist posterior pelvic tilt. IsP IR correction on left.',
            chain: 'Posterior chain \u2014 sagittal'
          },
          layer2: {
            laic: 'L hamstrings assist corrective posterior tilt but are not primary facilitation targets.'
          },
          layer3: {
            treatment: 'Indirectly trained. 90-90 hip lift uses hamstrings for posterior tilt.'
          }
        }
      },
      {
        id: 'coccygeus',
        label: 'Coccygeus',
        type: 'muscle',
        priColor: '--pri-violet',
        panelBox: {x: 0, y: 44, w: 14, h: 5},
        arrowTo: {x: 28, y: 60},
        polygon: [
          [22, 56], [30, 54], [36, 56], [38, 62],
          [36, 66], [30, 68], [24, 66], [20, 62]
        ],
        priDetail: {
          layer1: {
            standard: 'Pulls coccyx forward, supports pelvic floor.',
            pri: 'R coccygeus \u2192 R SI IR (posterior outlet closing). Internal rotation family.',
            chain: 'Deep posterior \u2014 internal rotation'
          },
          layer2: {
            laic: 'R coccygeus assists R SI IR. Bilateral coccygeus hypertonic in B PEC.'
          },
          layer3: {
            treatment: 'Release through pelvic floor relaxation. Not directly facilitated.'
          }
        }
      },
      {
        id: 'piriformis',
        label: 'Piriformis',
        type: 'muscle',
        priColor: '--pri-violet',
        panelBox: {x: 0, y: 52, w: 14, h: 5},
        arrowTo: {x: 30, y: 70},
        polygon: [
          [24, 66], [32, 64], [38, 66], [40, 72],
          [38, 76], [32, 78], [26, 76], [22, 72]
        ],
        priDetail: {
          layer1: {
            standard: 'Hip ER (hip extended), hip abduction.',
            pri: 'R piriformis \u2192 R SI IR assist. Internal rotation family.',
            chain: 'Deep posterior lateral rotator'
          },
          layer2: {
            laic: 'Overactive bilaterally in compensated patterns. Release, don\'t strengthen.'
          },
          layer3: {
            treatment: 'Inhibited through positioning. Not directly facilitated in early steps.'
          }
        }
      },
      {
        id: 'glute_max',
        label: 'Gluteus Maximus (L)',
        type: 'muscle',
        priColor: '--pri-violet',
        panelBox: {x: 0, y: 60, w: 14, h: 5},
        arrowTo: {x: 22, y: 78},
        polygon: [
          [10, 68], [18, 64], [28, 66], [34, 72],
          [34, 80], [28, 86], [18, 88], [10, 84],
          [8, 76]
        ],
        priDetail: {
          layer1: {
            standard: 'Hip extension, ER, abduction (upper fibers).',
            pri: 'R glute max (superior fibers) \u2192 R IS ER. Internal rotation family.',
            chain: 'Posterior \u2014 extension and rotation'
          },
          layer2: {
            laic: 'R superior glute max = corrective. L glute max compensatory in L AIC.'
          },
          layer3: {
            treatment: 'Step 6: R glute max facilitation. HALT 4/5 \u2192 5/5.'
          }
        }
      },
      {
        id: 'glute_max_r',
        label: 'Gluteus Maximus (R)',
        type: 'muscle',
        priColor: '--pri-violet',
        panelBox: {x: 86, y: 44, w: 14, h: 5},
        arrowTo: {x: 78, y: 78},
        polygon: [
          [66, 72], [72, 66], [82, 64], [90, 68],
          [92, 76], [90, 84], [82, 88], [72, 86],
          [66, 80]
        ],
        priDetail: {
          layer1: {
            standard: 'Hip extension, ER, abduction (upper fibers).',
            pri: 'R glute max (superior fibers) \u2192 R IS ER. Internal rotation family.',
            chain: 'Posterior \u2014 extension and rotation'
          },
          layer2: {
            laic: 'R superior glute max = corrective. L glute max compensatory in L AIC.'
          },
          layer3: {
            treatment: 'Step 6: R glute max facilitation. HALT 4/5 \u2192 5/5.'
          }
        }
      },
      {
        id: 'arcuate_tendon',
        label: 'Arcuate Tendon',
        type: 'muscle',
        priColor: '--pri-yellow',
        panelBox: {x: 0, y: 28, w: 14, h: 5},
        arrowTo: {x: 28, y: 24},
        polygon: [
          [25, 22], [30, 20], [32, 22], [32, 26],
          [30, 28], [25, 26]
        ],
        priDetail: {
          layer1: {
            standard: 'Thickened fascia of obturator internus, origin of levator ani.',
            pri: 'Integration landmark \u2014 connects obturator internus to pelvic floor.',
            chain: 'Integration \u2014 structural bridge'
          },
          layer2: {
            laic: 'Key anatomical bridge for pelvic floor muscle activation sequences.'
          },
          layer3: {
            treatment: 'Not directly targeted. Awareness landmark for pelvic floor anatomy.'
          }
        }
      },
      {
        id: 'anococcygeal_ligament',
        label: 'Anococcygeal Ligament',
        type: 'muscle',
        priColor: '--pri-yellow',
        panelBox: {x: 86, y: 36, w: 14, h: 5},
        arrowTo: {x: 48, y: 58},
        polygon: [
          [45, 52], [50, 50], [53, 52], [54, 58],
          [52, 64], [48, 66], [44, 64], [44, 58]
        ],
        priDetail: {
          layer1: {
            standard: 'Fibrous band between anus and coccyx, anchors pelvic floor.',
            pri: 'Integration structure connecting pelvic floor to coccyx.',
            chain: 'Integration \u2014 midline anchor'
          },
          layer2: {
            laic: 'Midline reference for sagittal pelvic floor position.'
          },
          layer3: {
            treatment: 'Not directly targeted. Structural landmark.'
          }
        }
      },
      {
        id: 'sacrum',
        label: 'Sacrum',
        type: 'landmark',
        priColor: '--pri-neutral',
        panelBox: {x: 20, y: 90, w: 13, h: 5},
        arrowTo: {x: 48, y: 64},
        landmarkMarker: {x: 48, y: 64},
        priDetail: {
          layer1: {
            standard: 'Triangular bone at base of spine.',
            pri: 'Sacral base = posterior inlet border. IS/SI joint reference.',
            chain: 'N/A \u2014 bony landmark'
          }
        }
      },
      {
        id: 'coccyx_bone',
        label: 'Coccyx',
        type: 'landmark',
        priColor: '--pri-neutral',
        panelBox: {x: 60, y: 90, w: 12, h: 5},
        arrowTo: {x: 42, y: 84},
        landmarkMarker: {x: 42, y: 84},
        priDetail: {
          layer1: {
            standard: 'Terminal spine segment. Outlet landmark.',
            pri: 'Coccyx + ischial tuberosities + pubic symphysis define outlet.',
            chain: 'N/A \u2014 bony landmark'
          }
        }
      },
      {
        id: 'pubic_symphysis',
        label: 'Pubic Symphysis',
        type: 'landmark',
        priColor: '--pri-neutral',
        panelBox: {x: 34, y: 0, w: 14, h: 4},
        arrowTo: {x: 49, y: 7},
        landmarkMarker: {x: 49, y: 7},
        priDetail: {
          layer1: {
            standard: 'Midline cartilaginous joint.',
            pri: 'Shared inlet AND outlet reference. IP and IsP joint reference bone.',
            chain: 'N/A \u2014 bony landmark'
          }
        }
      },
      {
        id: 'ischial_tuberosity',
        label: 'Ischial Tuberosity (L)',
        type: 'landmark',
        priColor: '--pri-neutral',
        panelBox: {x: 0, y: 4, w: 14, h: 5},
        arrowTo: {x: 18, y: 10},
        landmarkMarker: {x: 18, y: 10},
        priDetail: {
          layer1: {
            standard: 'Weight-bearing bony prominence. Outlet landmark.',
            pri: 'IsP IR = tuberosities adducting (outlet closing).',
            chain: 'N/A \u2014 bony landmark'
          }
        }
      },
      {
        id: 'ischial_tuberosity_r',
        label: 'Ischial Tuberosity (R)',
        type: 'landmark',
        priColor: '--pri-neutral',
        panelBox: {x: 86, y: 4, w: 14, h: 5},
        arrowTo: {x: 82, y: 10},
        landmarkMarker: {x: 82, y: 10},
        priDetail: {
          layer1: {
            standard: 'Weight-bearing bony prominence. Outlet landmark.',
            pri: 'IsP IR = tuberosities adducting (outlet closing).',
            chain: 'N/A \u2014 bony landmark'
          }
        }
      }
    ]
  },
  {
    id: 'anterior_pelvis',
    label: 'Anterior Pelvis',
    mechanic: 'label_hunt',
    imageSrc: 'img/pelvis-angle-r-side.png',
    structures: [
      {
        id: 'iliac_crest_l',
        label: 'Iliac crest',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 1, y: 7, w: 10, h: 3},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Superior border of the ilium. Attachment site for abdominal and back muscles.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'inner_lip',
        label: 'Inner lip',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 10, y: 10, w: 8, h: 2.5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Medial edge of the iliac crest. Origin of transversus abdominis and iliacus.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'intermediate_zone',
        label: 'Intermediate zone',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 7, y: 13, w: 14, h: 2.5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Middle area of the iliac crest between inner and outer lips. Origin of internal oblique.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'outer_lip',
        label: 'Outer lip',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 10, y: 16, w: 8, h: 2.5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Lateral edge of the iliac crest. Origin of external oblique and latissimus dorsi.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'tubercle',
        label: 'Tubercle',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 8, y: 19, w: 8, h: 2.5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Palpable prominence on the outer lip of the iliac crest. Landmark for the inguinal ligament.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'asis_l',
        label: 'Anterior superior iliac spine',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 0, y: 34, w: 16, h: 5},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Anterior projection of the iliac crest. Attachment of inguinal ligament and sartorius.',
            pri: 'INLET landmark. Defines anterior border of pelvic inlet with sacral base and pubic symphysis. ASIS drops forward/down in IP ER (anterior tilt).',
            chain: 'Inlet reference \u2014 IP joint'
          }
        }
      },
      {
        id: 'aiis_l',
        label: 'Anterior inferior iliac spine',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 0, y: 41, w: 16, h: 5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Bony projection inferior to ASIS. Origin of rectus femoris (straight head).',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'iliopubic_eminence',
        label: 'Iliopubic eminence',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 0, y: 54, w: 15, h: 4},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Bony ridge at junction of ilium and superior pubic ramus. Landmark for the pelvic brim.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'superior_pubic_ramus',
        label: 'Superior pubic ramus',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 0, y: 62, w: 15, h: 4},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Upper branch of the pubic bone extending from body to iliopubic eminence.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'obturator_foramen_l',
        label: 'Obturator foramen',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 0, y: 70, w: 14, h: 4},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Large opening in the hip bone formed by pubis and ischium. Mostly covered by obturator membrane.',
            pri: 'Obturator internus originates from inner surface. Key PRI muscle for outlet abduction. L obturator internus \u2192 L IsP ER (outlet opening).',
            chain: 'Outlet reference \u2014 IsP joint'
          }
        }
      },
      {
        id: 'pubic_tubercle_l',
        label: 'Pubic tubercle',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 0, y: 78, w: 13, h: 3},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Small projection on the superior pubic ramus. Attachment for the inguinal ligament.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'inferior_pubic_ramus',
        label: 'Inferior pubic ramus',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 0, y: 84, w: 14, h: 4},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Lower branch of the pubic bone joining the ischial ramus. Forms inferior border of obturator foramen.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'sacral_promontory',
        label: 'Sacral promontory',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 24, y: 10, w: 16, h: 3},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Anterior projection of the S1 vertebral body. Superior border of the pelvic inlet.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'l2_vertebra',
        label: 'L2',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 42, y: 1, w: 4, h: 2.5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Second lumbar vertebra.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'l3_vertebra',
        label: 'L3',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 42, y: 5, w: 4, h: 2.5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Third lumbar vertebra.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'l4_vertebra',
        label: 'L4',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 42, y: 9, w: 4, h: 2.5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Fourth lumbar vertebra.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'l5_vertebra',
        label: 'L5',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 42, y: 14, w: 4, h: 2.5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Fifth lumbar vertebra. Articulates with the sacrum at L5-S1.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'transverse_processes',
        label: 'Transverse processes of lumbar vertebrae',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 62, y: 2, w: 30, h: 4},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Lateral projections from lumbar vertebral bodies. Attachment sites for psoas major and quadratus lumborum.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'sacrum_ant',
        label: 'Sacrum',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 44, y: 43, w: 9, h: 3},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Triangular bone formed by fusion of five sacral vertebrae. Keystone of the pelvic ring.',
            pri: 'INLET landmark (sacral base = posterior inlet border). Also posterior outlet reference. IS IR/ER = ilium on sacrum. SI IR/ER = sacrum on ilium.',
            chain: 'Inlet/Outlet reference \u2014 IS and SI joints'
          }
        }
      },
      {
        id: 'coccyx_ant',
        label: 'Coccyx',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 46, y: 54, w: 8, h: 3},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Terminal segment of the vertebral column, formed by fusion of 3-5 coccygeal vertebrae.',
            pri: 'OUTLET landmark. Coccyx + ischial tuberosities + pubic symphysis define outlet borders. Coccygeus muscle attaches here. R coccygeus \u2192 R SI IR.',
            chain: 'Outlet reference \u2014 SI joint'
          }
        }
      },
      {
        id: 'inferior_pubic_ligament',
        label: 'Inferior pubic ligament',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 30, y: 89, w: 18, h: 3},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Ligament arching across the inferior aspect of the pubic symphysis, forming the upper border of the pubic arch.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'pubic_arch',
        label: 'Pubic arch',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 55, y: 90, w: 10, h: 3},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'The arch formed by the convergence of the inferior pubic rami. Angle differs between males and females.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'iliac_tuberosity',
        label: 'Iliac tuberosity',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 78, y: 7, w: 13, h: 3},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Roughened area on posterior ilium. Attachment of the posterior sacroiliac ligaments.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'iliac_crest_r',
        label: 'Iliac crest',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 82, y: 12, w: 11, h: 3},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Superior border of the ilium (right side). Attachment site for abdominal and back muscles.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'ala_of_ilium',
        label: 'Ala of ilium',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 82, y: 18, w: 11, h: 3},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Wing-shaped flat expansion of the upper ilium. Provides surface for gluteal muscle attachment.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'greater_sciatic_notch',
        label: 'Greater sciatic notch',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 80, y: 24, w: 16, h: 4},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Large notch on the posterior ilium/ischium. Piriformis and sciatic nerve pass through here.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'arcuate_line',
        label: 'Arcuate line',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 82, y: 32, w: 12, h: 3},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Smooth ridge on the internal surface of the ilium. Part of the linea terminalis defining the pelvic brim.',
            pri: 'Part of the linea terminalis \u2014 defines the pelvic brim (inlet border). Separates greater (false) pelvis from lesser (true) pelvis.',
            chain: 'Inlet reference \u2014 pelvic brim'
          }
        }
      },
      {
        id: 'ischial_spine',
        label: 'Ischial spine',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 82, y: 38, w: 12, h: 3},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Pointed eminence on the posterior ischium. Attachment of the sacrospinous ligament and coccygeus muscle.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'lesser_sciatic_notch',
        label: 'Lesser sciatic notch',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 80, y: 44, w: 15, h: 4},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Notch inferior to the ischial spine. Obturator internus tendon passes through the lesser sciatic foramen.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'greater_trochanter',
        label: 'Greater trochanter of femur',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 78, y: 52, w: 18, h: 5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Large bony prominence on the lateral proximal femur. Attachment of gluteus medius, gluteus minimus, and piriformis.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'pecten_pubis',
        label: 'Pecten pubis',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 82, y: 62, w: 13, h: 3},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Ridge on the superior ramus of the pubic bone forming part of the pelvic brim. Attachment of pectineus.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      },
      {
        id: 'pubic_symphysis_ant',
        label: 'Pubic symphysis',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 80, y: 70, w: 15, h: 3},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Midline cartilaginous joint connecting left and right pubic bones.',
            pri: 'SHARED landmark \u2014 both inlet AND outlet. The reference bone for IP (Ilio-Pubo) and IsP (Ischio-Pubo) joints. Pubalgia: B PEC position creates shearing here.',
            chain: 'Inlet/Outlet reference \u2014 IP and IsP joints'
          }
        }
      },
      {
        id: 'ischial_tuberosity_ant',
        label: 'Ischial tuberosity',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 80, y: 76, w: 15, h: 3},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Weight-bearing bony prominence of the ischium. Origin of hamstrings.',
            pri: 'OUTLET landmark. Defines lateral borders of pelvic outlet. IsP IR = ischial tuberosities adducting (outlet closing). IsP ER = abducting (outlet opening, pelvic diaphragm ascension).',
            chain: 'Outlet reference \u2014 IsP joint'
          }
        }
      },
      {
        id: 'lesser_trochanter',
        label: 'Lesser trochanter of femur',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 78, y: 82, w: 18, h: 5},
        hasPriData: false,
        priDetail: {
          layer1: {
            standard: 'Small conical projection on the posteromedial proximal femur. Attachment of the iliopsoas tendon.',
            note: 'Bony landmark \u2014 no PRI color assignment.'
          }
        }
      }
    ]
  }
];
