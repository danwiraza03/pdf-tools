# Third-Party Software & Font Notices

This project incorporates third-party open-source software libraries and font assets. All third-party components are stored locally and executed 100% client-side within the user's browser without external server requests or remote tracking.

The authors and contributors of **PDF Tools** gratefully acknowledge the developers and communities behind the following open-source projects:

---

## Table of Third-Party Components

### 1. Vendor Libraries (`js/lib/`)

| Library Name | Local Files / Paths | Version | License | Copyright Holder(s) |
|---|---|---|---|---|
| **@cantoo/pdf-lib** *(fork of pdf-lib)* | `js/lib/pdf-lib.min.js` | 2.11.1 | MIT | Copyright (c) 2019 Andrew Dillon, Copyright (c) Cantoo |
| **PDF.js** (Display / Viewer Engine) | `js/lib/pdf.min.js`, `js/lib/pdf.worker.min.js` | 3.11.174 | Apache-2.0 | Copyright 2023 Mozilla Foundation |
| **FileSaver.js** | `js/lib/FileSaver.min.js` | 2.0.5 | MIT | Copyright (c) 2016 Eli Grey |
| **SortableJS** | `js/lib/Sortable.min.js` | 1.15.0 | MIT | Copyright (c) 2019-2022 Lebedev Konstantin / All contributors to Sortable |
| **JSZip** | `js/lib/jszip.min.js` | 3.10.1 | MIT / GPLv3 | (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso |
| **Tesseract.js** | `js/lib/tesseract/tesseract.min.js`, `worker.min.js`, `tesseract-worker.bundle.js` | 7.0.0 | Apache-2.0 | Copyright (c) 2019 Jerome Wu, Naptha |
| **Tesseract.js Core (WASM)** | `js/lib/tesseract/tesseract-core*.wasm.js` | v5.x core build | Apache-2.0 | Copyright (c) 2019 Jerome Wu / Ray Smith, Google Inc. et al. |
| **Tesseract Traineddata Models** | `js/lib/tesseract/lang-data/eng.*`, `lang-data/ind.*` | 4.00 / fast | Apache-2.0 | Copyright (C) 2018 Google, Inc. / Tesseract-OCR authors |

### 2. Fonts (`fonts/`)

| Font Name | Local Files / Paths | Version | License | Copyright Holder(s) |
|---|---|---|---|---|
| **Caveat** | `fonts/caveat-regular.ttf`, `fonts/caveat-bold.ttf` | 1.1 | SIL OFL 1.1 | Copyright (c) 2014, Pablo Impallari (www.impallari.com) |
| **Dancing Script** | `fonts/dancingscript-regular.ttf`, `fonts/dancingscript-bold.ttf` | 1.1 | SIL OFL 1.1 | Copyright (c) 2011, Pablo Impallari (www.impallari.com) |
| **Great Vibes** | `fonts/greatvibes-regular.ttf` | 1.1 | SIL OFL 1.1 | Copyright (c) 2012, TypeSETit, LLC (typesetit@att.net) |
| **Pacifico** | `fonts/pacifico-regular.ttf` | 1.1 | SIL OFL 1.1 | Copyright (c) 2011 by Vernon Adams (vern@sansoxygen.com) |
| **Sacramento** | `fonts/sacramento-regular.ttf` | 1.1 | SIL OFL 1.1 | Copyright (c) 2012, Brian J. Bonislawsky DBA Astigmatic (astigma@astigmatic.com) |

---

## Detailed Notices & In-File Headers

### 1. `@cantoo/pdf-lib` (v2.11.1)
- **Files:** `js/lib/pdf-lib.min.js`
- **License:** MIT License
- **Copyright:** Copyright (c) 2019 Andrew Dillon, Copyright (c) Cantoo
- **Upstream Source:** https://github.com/cantoo-scribe/pdf-lib (NPM: `@cantoo/pdf-lib`)
- **File Header Notice:** The minified bundle does not include an inline header comment; licensing is documented in package metadata and `js/lib/VENDORS.md`.
- **License Text:** See [The MIT License](#the-mit-license) below.

### 2. `PDF.js` (v3.11.174)
- **Files:** `js/lib/pdf.min.js`, `js/lib/pdf.worker.min.js`
- **License:** Apache License 2.0
- **Copyright:** Copyright 2023 Mozilla Foundation
- **Upstream Source:** https://github.com/mozilla/pdf.js (NPM: `pdfjs-dist`)
- **File Header Notice:** The following notice appears at the top of `js/lib/pdf.min.js` and `js/lib/pdf.worker.min.js`:
  ```javascript
  /**
   * @licstart The following is the entire license notice for the
   * JavaScript code in this page
   *
   * Copyright 2023 Mozilla Foundation
   *
   * Licensed under the Apache License, Version 2.0 (the "License");
   * you may not use this file except in compliance with the License.
   * You may obtain a copy of the License at
   *
   *     http://www.apache.org/licenses/LICENSE-2.0
   *
   * Unless required by applicable law or agreed to in writing, software
   * distributed under the License is distributed on an "AS IS" BASIS,
   * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   * See the License for the specific language governing permissions and
   * limitations under the License.
   *
   * @licend The above is the entire license notice for the
   * JavaScript code in this page
   */
  ```
- **License Text:** See [Apache License, Version 2.0](#apache-license-version-20) below.

### 3. `FileSaver.js` (v2.0.5)
- **Files:** `js/lib/FileSaver.min.js`
- **License:** MIT License
- **Copyright:** Copyright (c) 2016 Eli Grey
- **Upstream Source:** https://github.com/eligrey/FileSaver.js (NPM: `file-saver`)
- **File Header Notice:** The minified distribution file does not contain an inline header comment.
- **License Text:** See [The MIT License](#the-mit-license) below.

### 4. `SortableJS` (v1.15.0)
- **Files:** `js/lib/Sortable.min.js`
- **License:** MIT License
- **Copyright:** Copyright (c) 2019-2022 Lebedev Konstantin / All contributors to Sortable
- **Upstream Source:** https://github.com/SortableJS/Sortable (NPM: `sortablejs`)
- **File Header Notice:** The following notice appears at the top of `js/lib/Sortable.min.js`:
  ```javascript
  /*! Sortable 1.15.0 - MIT | git://github.com/SortableJS/Sortable.git */
  ```
- **License Text:** See [The MIT License](#the-mit-license) below.

### 5. `JSZip` (v3.10.1)
- **Files:** `js/lib/jszip.min.js`
- **License:** Dual-licensed under the MIT License or GPLv3
- **Copyright:** (c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>, David Duponchel, Franz Buchinger, António Afonso
- **Upstream Source:** https://github.com/Stuk/jszip (NPM: `jszip`)
- **File Header Notice:** The following notice appears at the top of `js/lib/jszip.min.js`:
  ```javascript
  /*!

  JSZip v3.10.1 - A JavaScript class for generating and reading zip files
  <http://stuartk.com/jszip>

  (c) 2009-2016 Stuart Knightley <stuart [at] stuartk.com>
  Dual licenced under the MIT license or GPLv3. See https://raw.github.com/Stuk/jszip/main/LICENSE.markdown.

  JSZip uses the library pako released under the MIT license :
  https://github.com/nodeca/pako/blob/main/LICENSE
  */
  ```
- **License Text:** See [The MIT License](#the-mit-license) below.

### 6. `Tesseract.js` (v7.0.0)
- **Files:** `js/lib/tesseract/tesseract.min.js`, `js/lib/tesseract/worker.min.js`, `js/lib/tesseract/tesseract-worker.bundle.js`
- **License:** Apache License 2.0
- **Copyright:** Copyright (c) 2019 Jerome Wu, Naptha
- **Upstream Source:** https://github.com/naptha/tesseract.js (NPM: `tesseract.js`)
- **File Header Notice:** The following banner appears at the top of `tesseract.min.js` and `worker.min.js`:
  ```javascript
  /*! For license information please see tesseract.min.js.LICENSE.txt */
  ```
  *(Note: The standalone `.LICENSE.txt` file is omitted in the offline distribution bundle; the underlying license is Apache License 2.0).*
- **License Text:** See [Apache License, Version 2.0](#apache-license-version-20) below.

### 7. `Tesseract.js Core (WebAssembly)` (v5.x build)
- **Files:** `js/lib/tesseract/tesseract-core.wasm.js`, `tesseract-core-lstm.wasm.js`, `tesseract-core-simd-lstm.wasm.js`
- **License:** Apache License 2.0
- **Copyright:** Copyright (c) 2019 Jerome Wu / Ray Smith, Google Inc. et al.
- **Upstream Source:** https://github.com/naptha/tesseract.js-core
- **File Header Notice:** Compiled Emscripten WebAssembly loader module without inline comment header.
- **License Text:** See [Apache License, Version 2.0](#apache-license-version-20) below.

### 8. `Tesseract Traineddata Models` (v4.00 / fast)
- **Files:** `js/lib/tesseract/lang-data/eng.*`, `js/lib/tesseract/lang-data/ind.*`
- **License:** Apache License 2.0
- **Copyright:** Copyright (C) 2018 Google, Inc. / Tesseract-OCR authors
- **Upstream Source:** https://github.com/tesseract-ocr/tessdata_fast
- **File Header Notice:** Binary neural network language weights serialized in JavaScript base64 loaders without inline comment header.
- **License Text:** See [Apache License, Version 2.0](#apache-license-version-20) below.

### 9. Offline Calligraphy Fonts (`fonts/`)
- **Files:** `fonts/caveat-*.ttf`, `fonts/dancingscript-*.ttf`, `fonts/greatvibes-*.ttf`, `fonts/pacifico-*.ttf`, `fonts/sacramento-*.ttf`
- **License:** SIL Open Font License, Version 1.1 (OFL-1.1)
- **Copyright Notices:**
  - Caveat: Copyright (c) 2014, Pablo Impallari (www.impallari.com)
  - Dancing Script: Copyright (c) 2011, Pablo Impallari (www.impallari.com)
  - Great Vibes: Copyright (c) 2012, TypeSETit, LLC (typesetit@att.net)
  - Pacifico: Copyright (c) 2011 by Vernon Adams (vern@sansoxygen.com)
  - Sacramento: Copyright (c) 2012, Brian J. Bonislawsky DBA Astigmatic (astigma@astigmatic.com)
- **File Header Notice:** Documented directly in [`fonts/OFL.txt`](fonts/OFL.txt).
- **License Text:** See [SIL Open Font License, Version 1.1](#sil-open-font-license-version-11) below.

---

## Full License Texts

### The MIT License

```text
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

### Apache License, Version 2.0

```text
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS
```

---

### SIL Open Font License, Version 1.1

```text
-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font
creation efforts of academic and linguistic communities, and to provide
a free and open framework in which fonts may be shared and improved in
partnership with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Source or Binary forms, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as a stand-alone text file, a human-readable header or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless prominent written permission is granted by the
corresponding Copyright Holder. This restriction only applies to the
primary font name as presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```
