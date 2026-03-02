/**
 * Structures for the Pelvic Outlet (Inferior) view — shared between the
 * normal and flipped image sets so data isn't duplicated.
 */
const OUTLET_INFERIOR_STRUCTURES = [
  // === Anatomical Right (image-left in the natural inferior view) ===
  {
    id: 'arcuate_tendon_r',
    label: 'Arcuate Tendon (R)',
    type: 'muscle',
    priColor: '--pri-neutral',
    panelBox: {x: 0, y: 14, w: 14.5, h: 3.5},
    arrowTo: {x: 28, y: 20},
    priDetail: {
      layer1: {
        standard: 'Thickened fascia of obturator internus, origin of levator ani.',
        pri: 'R arcuate tendon is not a primary PRI corrective. Only L is yellow (Integration).',
        chain: 'Integration \u2014 structural bridge'
      }
    }
  },
  {
    id: 'obturator_internus_r',
    label: 'Obturator Internus (R)',
    type: 'muscle',
    priColor: '--pri-neutral',
    panelBox: {x: 0, y: 32, w: 17, h: 3.5},
    arrowTo: {x: 18, y: 35},
    priDetail: {
      layer1: {
        standard: 'Femoral ER (open-chain), pelvic diaphragm ascension (closed-chain).',
        pri: 'R obturator internus is not a primary PRI corrective. Only L OI is green (Frontal Abduction).',
        chain: 'Pelvic floor \u2014 deep interior chain'
      }
    }
  },
  {
    id: 'coccygeus_r',
    label: 'Coccygeus (R)',
    type: 'muscle',
    priColor: '--pri-violet',
    panelBox: {x: 0, y: 54, w: 11, h: 3.5},
    arrowTo: {x: 22, y: 58},
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
    id: 'iliococcygeus_r',
    label: 'Iliococcygeus (R)',
    type: 'muscle',
    priColor: '--pri-neutral',
    panelBox: {x: 0, y: 64, w: 14.5, h: 3.5},
    arrowTo: {x: 30, y: 62},
    priDetail: {
      layer1: {
        standard: 'Pelvic floor support, coccyx stabilization.',
        pri: 'R iliococcygeus is not a primary PRI corrective. Only L is green (Frontal Abduction).',
        chain: 'Pelvic floor \u2014 frontal plane'
      }
    }
  },
  // === Midline ===
  {
    id: 'puborectalis',
    label: 'Puborectalis (L)',
    type: 'muscle',
    priColor: '--pri-brown',
    panelBox: {x: 18, y: 88, w: 14, h: 3.5},
    arrowTo: {x: 46, y: 50},
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
    id: 'anococcygeal_ligament',
    label: 'Anococcygeal Lig.',
    type: 'muscle',
    priColor: '--pri-yellow',
    panelBox: {x: 52, y: 88, w: 14.5, h: 3.5},
    arrowTo: {x: 48, y: 68},
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
  // === Anatomical Left (image-right in the natural inferior view) ===
  {
    id: 'arcuate_tendon_l',
    label: 'Arcuate Tendon (L)',
    type: 'muscle',
    priColor: '--pri-yellow',
    panelBox: {x: 85.5, y: 8, w: 14.5, h: 3.5},
    arrowTo: {x: 70, y: 20},
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
    id: 'medial_hamstring',
    label: 'Medial Hamstring (L)',
    type: 'muscle',
    priColor: '--pri-brown',
    panelBox: {x: 83.5, y: 20, w: 16.5, h: 3.5},
    arrowTo: {x: 74, y: 28},
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
    id: 'obturator_internus_l',
    label: 'Obturator Internus (L)',
    type: 'muscle',
    priColor: '--pri-green-family',
    panelBox: {x: 83, y: 32, w: 17, h: 3.5},
    arrowTo: {x: 80, y: 35},
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
    id: 'glute_max_l',
    label: 'Glute Max (L)',
    type: 'muscle',
    priColor: '--pri-neutral',
    panelBox: {x: 89, y: 48, w: 11, h: 3.5},
    arrowTo: {x: 85, y: 52},
    priDetail: {
      layer1: {
        standard: 'Hip extension, ER, abduction (upper fibers).',
        pri: 'L glute max is not a primary PRI corrective. Only R glute max is violet (Internal Rotation).',
        chain: 'Posterior \u2014 extension and rotation'
      }
    }
  },
  {
    id: 'iliococcygeus_l',
    label: 'Iliococcygeus (L)',
    type: 'muscle',
    priColor: '--pri-green-family',
    panelBox: {x: 85.5, y: 60, w: 14.5, h: 3.5},
    arrowTo: {x: 68, y: 62},
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
    id: 'pubococcygeus_l',
    label: 'Pubococcygeus (L)',
    type: 'muscle',
    priColor: '--pri-brown',
    panelBox: {x: 85.5, y: 72, w: 14.5, h: 3.5},
    arrowTo: {x: 62, y: 55},
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
  }
];

window.ANATOMIZE_IMAGES = [
  // =====================================================================
  // 1. Pelvic Outlet — Superior view (page 6)
  // =====================================================================
  {
    id: 'pelvic_outlet',
    label: 'Outlet Superior',
    mechanic: 'blank_panels',
    imageSrc: 'img/PRI-1-Pelvic-Outlet2.jpg',
    structures: [
      // --- Left side (8 structures) ---
      {
        id: 'puborectalis',
        label: 'Puborectalis (L)',
        type: 'muscle',
        priColor: '--pri-brown',
        panelBox: {x: 0, y: 6, w: 14, h: 3.5},
        arrowTo: {x: 40, y: 25},
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
        id: 'pubococcygeus',
        label: 'Pubococcygeus (L)',
        type: 'muscle',
        priColor: '--pri-brown',
        panelBox: {x: 0, y: 13, w: 14.5, h: 3.5},
        arrowTo: {x: 35, y: 32},
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
        id: 'arcuate_tendon',
        label: 'Arcuate Tendon (L)',
        type: 'muscle',
        priColor: '--pri-yellow',
        panelBox: {x: 0, y: 20, w: 14.5, h: 3.5},
        arrowTo: {x: 25, y: 28},
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
        id: 'iliococcygeus',
        label: 'Iliococcygeus (L)',
        type: 'muscle',
        priColor: '--pri-green-family',
        panelBox: {x: 0, y: 30, w: 14.5, h: 3.5},
        arrowTo: {x: 30, y: 42},
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
        id: 'obturator_internus',
        label: 'Obturator Internus (L)',
        type: 'muscle',
        priColor: '--pri-green-family',
        panelBox: {x: 0, y: 40, w: 17, h: 3.5},
        arrowTo: {x: 18, y: 35},
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
        id: 'coccygeus_l',
        label: 'Coccygeus (L)',
        type: 'muscle',
        priColor: '--pri-neutral',
        panelBox: {x: 0, y: 50, w: 11, h: 3.5},
        arrowTo: {x: 32, y: 60},
        priDetail: {
          layer1: {
            standard: 'Pulls coccyx forward, supports pelvic floor.',
            pri: 'L coccygeus is not a primary PRI corrective. Only R coccygeus is violet (Internal Rotation).',
            chain: 'Deep posterior \u2014 internal rotation'
          }
        }
      },
      {
        id: 'piriformis_l',
        label: 'Piriformis (L)',
        type: 'muscle',
        priColor: '--pri-neutral',
        panelBox: {x: 0, y: 60, w: 11.5, h: 3.5},
        arrowTo: {x: 28, y: 68},
        priDetail: {
          layer1: {
            standard: 'Hip ER (hip extended), hip abduction.',
            pri: 'L piriformis is not a primary PRI corrective. Only R piriformis is violet (Internal Rotation).',
            chain: 'Deep posterior lateral rotator'
          }
        }
      },
      {
        id: 'anococcygeal_ligament',
        label: 'Anococcygeal Lig.',
        type: 'muscle',
        priColor: '--pri-yellow',
        panelBox: {x: 0, y: 70, w: 14.5, h: 3.5},
        arrowTo: {x: 48, y: 55},
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
      // --- Right side (4 structures) ---
      {
        id: 'iliococcygeus_r',
        label: 'Iliococcygeus (R)',
        type: 'muscle',
        priColor: '--pri-neutral',
        panelBox: {x: 85.5, y: 28, w: 14.5, h: 3.5},
        arrowTo: {x: 68, y: 42},
        priDetail: {
          layer1: {
            standard: 'Pelvic floor support, coccyx stabilization.',
            pri: 'R iliococcygeus is not a primary PRI corrective. Only L is green (Frontal Abduction).',
            chain: 'Pelvic floor \u2014 frontal plane'
          }
        }
      },
      {
        id: 'obturator_internus_r',
        label: 'Obturator Internus (R)',
        type: 'muscle',
        priColor: '--pri-neutral',
        panelBox: {x: 83, y: 38, w: 17, h: 3.5},
        arrowTo: {x: 80, y: 35},
        priDetail: {
          layer1: {
            standard: 'Femoral ER (open-chain), pelvic diaphragm ascension (closed-chain).',
            pri: 'R obturator internus is not a primary PRI corrective. Only L OI is green (Frontal Abduction).',
            chain: 'Pelvic floor \u2014 deep interior chain'
          }
        }
      },
      {
        id: 'coccygeus_r',
        label: 'Coccygeus (R)',
        type: 'muscle',
        priColor: '--pri-violet',
        panelBox: {x: 89, y: 50, w: 11, h: 3.5},
        arrowTo: {x: 68, y: 60},
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
        id: 'piriformis_r',
        label: 'Piriformis (R)',
        type: 'muscle',
        priColor: '--pri-violet',
        panelBox: {x: 88.5, y: 60, w: 11.5, h: 3.5},
        arrowTo: {x: 72, y: 68},
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
      }
    ]
  },

  // =====================================================================
  // 2. Pelvic Outlet — Inferior view (page 4)
  // =====================================================================
  {
    id: 'pelvic_outlet_inferior',
    label: 'Outlet Inferior',
    mechanic: 'blank_panels',
    imageSrc: 'img/PRI-1-Pelvic-Outlet.jpg',
    structures: OUTLET_INFERIOR_STRUCTURES
  },

  // =====================================================================
  // 3. Pelvic Outlet — Inferior (Flipped) — same image CSS-mirrored
  // =====================================================================
  {
    id: 'pelvic_outlet_inferior_flipped',
    label: 'Outlet Inferior (Flipped)',
    mechanic: 'blank_panels',
    imageSrc: 'img/PRI-1-Pelvic-Outlet.jpg',
    flipped: true,
    structures: OUTLET_INFERIOR_STRUCTURES
  },

  // =====================================================================
  // 4. Pelvic Inlet (page 2)
  // =====================================================================
  {
    id: 'pelvic_inlet',
    label: 'Pelvic Inlet',
    mechanic: 'blank_panels',
    imageSrc: 'img/PRI-1-Pelvic-Inlet.png',
    structures: [
      {
        id: 'iliacus',
        label: 'Iliacus (L)',
        type: 'muscle',
        priColor: '--pri-red',
        panelBox: {x: 0, y: 10, w: 11, h: 3.5},
        arrowTo: {x: 62, y: 35},
        priDetail: {
          layer1: {
            standard: 'Hip flexion, stabilizes hip joint.',
            pri: 'L iliacus \u2192 L IP ER (anterior tilt). Frontal Adduction family.',
            chain: 'Anterior chain \u2014 frontal adduction'
          },
          layer2: {
            laic: 'L iliacus pulls left ilium into anterior tilt (IP ER). Part of L AIC pattern.'
          },
          layer3: {
            treatment: 'Inhibited through reciprocal inhibition. Not directly facilitated.'
          }
        }
      },
      {
        id: 'sartorius',
        label: 'Sartorius (R)',
        type: 'muscle',
        priColor: '--pri-brown',
        panelBox: {x: 0, y: 55, w: 12, h: 3.5},
        arrowTo: {x: 25, y: 52},
        priDetail: {
          layer1: {
            standard: 'Hip flexion, abduction, ER; knee flexion, IR.',
            pri: 'R sartorius \u2192 sagittal plane. Brown (Sagittal) family.',
            chain: 'Anterior \u2014 sagittal plane'
          }
        }
      },
      {
        id: 'rectus_femoris',
        label: 'Rectus Femoris (R)',
        type: 'muscle',
        priColor: '--pri-brown',
        panelBox: {x: 0, y: 70, w: 14.5, h: 3.5},
        arrowTo: {x: 28, y: 58},
        priDetail: {
          layer1: {
            standard: 'Hip flexion, knee extension.',
            pri: 'R rectus femoris \u2192 sagittal plane. Brown (Sagittal) family.',
            chain: 'Anterior \u2014 sagittal plane'
          }
        }
      },
      {
        id: 'internal_oblique_ta',
        label: 'Int. Oblique / TA (L)',
        type: 'muscle',
        priColor: '--pri-yellow',
        panelBox: {x: 84, y: 10, w: 16, h: 3.5},
        arrowTo: {x: 75, y: 18},
        priDetail: {
          layer1: {
            standard: 'Trunk rotation, compression of abdominal contents.',
            pri: 'L internal obliques + L transverse abdominis \u2192 Integration (Yellow). ZOA restoration.',
            chain: 'Integration \u2014 abdominal wall'
          },
          layer2: {
            laic: 'Key Integration muscles. Restore ZOA, oppose diaphragm descent on L side.'
          },
          layer3: {
            treatment: 'Facilitated through 90-90 hip lift with balloon, wall squat exhale.'
          }
        }
      }
    ]
  },

  // =====================================================================
  // 5. Pelvic Inlet (Bone) — Glute Med / Glute Max
  // =====================================================================
  {
    id: 'pelvic_inlet_bone',
    label: 'Glute Med / Max',
    mechanic: 'blank_panels',
    imageSrc: 'img/PRI-1-glute-med--glute-max.png',
    structures: [
      {
        id: 'glute_medius',
        label: 'Gluteus Medius (L)',
        type: 'muscle',
        priColor: '--pri-orange',
        panelBox: {x: 0, y: 10, w: 14.5, h: 3.5},
        arrowTo: {x: 25, y: 30},
        priDetail: {
          layer1: {
            standard: 'Hip abduction, IR (anterior fibers), ER (posterior fibers).',
            pri: 'L gluteus medius \u2192 Transverse Plane. Orange family.',
            chain: 'Lateral \u2014 transverse plane'
          },
          layer2: {
            laic: 'L glute med anterior fibers assist femoral IR correction. Transverse plane stabilizer.'
          },
          layer3: {
            treatment: 'Step 5: L glute med facilitation. HALT 3/5 \u2192 4/5.'
          }
        }
      },
      {
        id: 'glute_maximus_inlet',
        label: 'Gluteus Maximus (R)',
        type: 'muscle',
        priColor: '--pri-violet',
        panelBox: {x: 83, y: 10, w: 17, h: 3.5},
        arrowTo: {x: 65, y: 45},
        priDetail: {
          layer1: {
            standard: 'Hip extension, ER, abduction (upper fibers).',
            pri: 'R glute max (superior fibers) \u2192 R IS ER. Internal Rotation (Violet) family.',
            chain: 'Posterior \u2014 internal rotation'
          },
          layer2: {
            laic: 'R superior glute max = corrective. L glute max compensatory in L AIC.'
          },
          layer3: {
            treatment: 'Step 6: R glute max facilitation. HALT 4/5 \u2192 5/5.'
          }
        }
      }
    ]
  },

  // =====================================================================
  // 6. Anterior Pelvis — label_hunt (Netter image)
  // =====================================================================
  {
    id: 'anterior_pelvis',
    label: 'Anterior Pelvis',
    mechanic: 'label_hunt',
    imageSrc: 'img/pelvis-angle-r-side.png',
    structures: [
      // --- Left column (top to bottom) ---
      {
        id: 'iliac_crest_l',
        label: 'Iliac crest',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 4, y: 20, w: 5, h: 4},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Superior border of the ilium. Attachment site for abdominal and back muscles.'}}
      },
      {
        id: 'inner_lip',
        label: 'Inner lip',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 7, y: 13, w: 7, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Medial edge of the iliac crest. Origin of transversus abdominis and iliacus.'}}
      },
      {
        id: 'intermediate_zone',
        label: 'Intermediate zone',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 5, y: 16, w: 10, h: 4},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Middle area of the iliac crest. Origin of internal oblique.'}}
      },
      {
        id: 'outer_lip',
        label: 'Outer lip',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 7, y: 22, w: 7, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Lateral edge of the iliac crest. Origin of external oblique and latissimus dorsi.'}}
      },
      {
        id: 'tubercle',
        label: 'Tubercle',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 7, y: 26, w: 7, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Prominence on the outer lip of the iliac crest. Landmark for inguinal ligament.'}}
      },
      {
        id: 'asis_l',
        label: 'Anterior superior iliac spine',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 1, y: 45, w: 14, h: 4},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Anterior projection of the iliac crest. Attachment of inguinal ligament and sartorius.',
            pri: 'INLET landmark. ASIS drops forward/down in IP ER (anterior tilt).',
            chain: 'Inlet reference \u2014 IP joint'
          }
        }
      },
      {
        id: 'aiis_l',
        label: 'Anterior inferior iliac spine',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 1, y: 52, w: 14, h: 4},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Bony projection inferior to ASIS. Origin of rectus femoris (straight head).'}}
      },
      {
        id: 'iliopubic_eminence',
        label: 'Iliopubic eminence',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 3, y: 59, w: 9, h: 4},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Bony ridge at junction of ilium and superior pubic ramus. Pelvic brim landmark.'}}
      },
      {
        id: 'superior_pubic_ramus',
        label: 'Superior pubic ramus',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 3, y: 66, w: 10, h: 4},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Upper branch of the pubic bone extending from body to iliopubic eminence.'}}
      },
      {
        id: 'obturator_foramen_l',
        label: 'Obturator foramen',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 3, y: 73, w: 9, h: 4},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Large opening formed by pubis and ischium. Covered by obturator membrane.',
            pri: 'Obturator internus originates from inner surface. Key PRI muscle for outlet abduction.',
            chain: 'Outlet reference \u2014 IsP joint'
          }
        }
      },
      {
        id: 'pubic_tubercle_l',
        label: 'Pubic tubercle',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 3, y: 79, w: 11, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Small projection on the superior pubic ramus. Attachment for inguinal ligament.'}}
      },
      {
        id: 'inferior_pubic_ramus',
        label: 'Inferior pubic ramus',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 2, y: 85, w: 10, h: 4},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Lower branch of the pubic bone joining the ischial ramus.'}}
      },
      // --- Center / spine labels ---
      {
        id: 'sacral_promontory',
        label: 'Sacral promontory',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 28, y: 11, w: 8, h: 4},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Anterior projection of S1 vertebral body. Superior border of the pelvic inlet.'}}
      },
      {
        id: 'l2_vertebra',
        label: 'L2',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 50, y: 6, w: 2.5, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Second lumbar vertebra.'}}
      },
      {
        id: 'l3_vertebra',
        label: 'L3',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 48, y: 12, w: 2.5, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Third lumbar vertebra.'}}
      },
      {
        id: 'l4_vertebra',
        label: 'L4',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 46, y: 18, w: 2.5, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Fourth lumbar vertebra.'}}
      },
      {
        id: 'l5_vertebra',
        label: 'L5',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 42, y: 25, w: 2.5, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Fifth lumbar vertebra. Articulates with the sacrum at L5-S1.'}}
      },
      {
        id: 'sacrum_ant',
        label: 'Sacrum',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 48, y: 49, w: 6, h: 2.5},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Triangular bone formed by fusion of five sacral vertebrae. Keystone of the pelvic ring.',
            pri: 'INLET landmark (sacral base = posterior inlet border). IS/SI joint reference.',
            chain: 'Inlet/Outlet reference \u2014 IS and SI joints'
          }
        }
      },
      {
        id: 'coccyx_ant',
        label: 'Coccyx',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 46, y: 58, w: 6, h: 2.5},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Terminal segment of the vertebral column.',
            pri: 'OUTLET landmark. Coccyx + ischial tuberosities + pubic symphysis define outlet. R coccygeus \u2192 R SI IR.',
            chain: 'Outlet reference \u2014 SI joint'
          }
        }
      },
      // --- Top right ---
      {
        id: 'transverse_processes',
        label: 'Transverse processes of lumbar vertebrae',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 56, y: 10, w: 28, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Lateral projections from lumbar vertebral bodies. Attachment for psoas major and quadratus lumborum.'}}
      },
      {
        id: 'iliac_tuberosity',
        label: 'Iliac tuberosity',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 56, y: 15, w: 12, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Roughened area on posterior ilium. Attachment of posterior sacroiliac ligaments.'}}
      },
      // --- Right column (top to bottom) ---
      {
        id: 'iliac_crest_r',
        label: 'Iliac crest',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 69, y: 20, w: 9, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Superior border of the ilium (right side).'}}
      },
      {
        id: 'ala_of_ilium',
        label: 'Ala of ilium',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 68, y: 25, w: 10, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Wing-shaped expansion of the upper ilium. Surface for gluteal muscle attachment.'}}
      },
      {
        id: 'greater_sciatic_notch',
        label: 'Greater sciatic notch',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 68, y: 31, w: 10, h: 6},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Large notch on the posterior ilium/ischium. Piriformis and sciatic nerve pass through.'}}
      },
      {
        id: 'arcuate_line',
        label: 'Arcuate line',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 68, y: 41, w: 10, h: 2.5},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Ridge on internal surface of the ilium. Part of the linea terminalis (pelvic brim).',
            pri: 'Defines the pelvic brim (inlet border). Separates false from true pelvis.',
            chain: 'Inlet reference \u2014 pelvic brim'
          }
        }
      },
      {
        id: 'ischial_spine',
        label: 'Ischial spine',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 68, y: 46, w: 10, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Pointed eminence on the posterior ischium. Attachment of sacrospinous ligament and coccygeus.'}}
      },
      {
        id: 'lesser_sciatic_notch',
        label: 'Lesser sciatic notch',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 68, y: 51, w: 10, h: 4},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Notch inferior to ischial spine. Obturator internus tendon passes through.'}}
      },
      {
        id: 'greater_trochanter',
        label: 'Greater trochanter of femur',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 68, y: 59, w: 12, h: 4},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Large bony prominence on lateral proximal femur. Attachment of gluteus medius, minimus, piriformis.'}}
      },
      {
        id: 'pecten_pubis',
        label: 'Pecten pubis',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 68, y: 67, w: 10, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Ridge on the superior pubic ramus forming part of the pelvic brim. Attachment of pectineus.'}}
      },
      {
        id: 'pubic_symphysis_ant',
        label: 'Pubic symphysis',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 68, y: 73, w: 12, h: 2.5},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Midline cartilaginous joint connecting left and right pubic bones.',
            pri: 'SHARED landmark \u2014 both inlet AND outlet. Reference for IP and IsP joints.',
            chain: 'Inlet/Outlet reference \u2014 IP and IsP joints'
          }
        }
      },
      {
        id: 'ischial_tuberosity_ant',
        label: 'Ischial tuberosity',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 68, y: 79, w: 12, h: 2.5},
        hasPriData: true,
        priDetail: {
          layer1: {
            standard: 'Weight-bearing bony prominence. Origin of hamstrings.',
            pri: 'OUTLET landmark. IsP IR = tuberosities adducting. IsP ER = abducting (outlet opening).',
            chain: 'Outlet reference \u2014 IsP joint'
          }
        }
      },
      {
        id: 'lesser_trochanter',
        label: 'Lesser trochanter of femur',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 68, y: 84, w: 12, h: 4},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Small conical projection on posteromedial proximal femur. Attachment of iliopsoas.'}}
      },
      // --- Bottom center ---
      {
        id: 'inferior_pubic_ligament',
        label: 'Inferior pubic ligament',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 30, y: 83, w: 16, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Ligament arching across the inferior pubic symphysis.'}}
      },
      {
        id: 'pubic_arch',
        label: 'Pubic arch',
        type: 'landmark',
        priColor: '--pri-neutral',
        hitbox: {x: 58, y: 81, w: 8, h: 2.5},
        hasPriData: false,
        priDetail: {layer1: {standard: 'Arch formed by convergence of inferior pubic rami.'}}
      }
    ]
  }
];
