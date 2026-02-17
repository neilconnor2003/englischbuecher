// backend/utils/email.js
const nodemailer = require('nodemailer');
const juice = require('juice');
const config = require('../config');

// 100% RELIABLE LOGO — EMBEDDED BASE64 (copy your own string here)
const embeddedLogo = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCACkAw0DASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD9U6KKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAopPSorq6js7aW4mdY4YlLu7dFUDJJo8gJqK85tv2ifhtdglPGuigA4+a7Rf5mp/+F+fDof8AM7aH/wCB0f8AjXV9UxH/AD7f3M6Pq9ZfYf3Hf0V5/wD8L++HP/Q7aH/4HR/40f8AC/vhz/0O2h/+B0f+NH1XEf8APt/cw+r1v5H9x6BRXAD4+fDpunjTRWPot4jH9DTl+PHw+bp4v0n/AMCV/wAaPquI/wCfb+5i+r1v5H9x3tFcTpPxo8E69q1tpmneJtOvL+4bZFbwzBmc4JwAPpXaZPesZ0503acWvUzlCUHaSsOopM0tZkBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUjNtr52+OX7T2q/CX4hDw/aaDa6nbNYxXQmkuTGwZmdSDgH+6O3rXZhcJVxtT2VFXe51YfDVMVP2dJan0VRXx1P+3Nr0cRYeELE8f8AQQI7e6CvqH4c+KJ/GngPQtduoI7a41CzjuXhjbKoWUHAPpXRi8txOCgp1lZPTc2xGBrYWKlVWjOkoprNhSa+TNa/bH8RaT4g1XTh4e06RLO7mt1f7QykhHKjI9cCs8HgK+OclQV7GeGwlXFXVJbH1rRXxdqn7cXie3jbyvDulq46Fp3YfiARX2Pp9011YwTsADIgYge4zV4zLsRgVF11a+xWJwVbCpOqty1RSZpa8w4QooooAKKKKACikY4r51+PH7UGqfCH4gQaBaaHaajbyWMd15s1wY2DM7qR0P8AdH612YTCVcbU9lRV2dWHw1TFT9nSWp9F0V8cv+3Jr2xtnhOxLAcf6af/AIkV9NfCvxfd+PPAOj69e20VpdXsPmPDCxZVOSMA/hXTi8sxOBgqlZWT03NsRga2FipVVudZRSUteUeeFFFFABRSVBeXkWn2s1zcSLDBChkkkboqgZJ/Kjd2AsUV53a/tB/Dm8XfH4z0cL/tXaL/ADNTn48fDtevjXQ//A6P/wCKrq+qYj/n2/uZ0fV638j+472iuAb4+fDlRk+NtD/8Do/8aQftAfDgnH/Cb6H/AOB0f+NH1XEf8+39zF9XrfyP7j0CiuBHx6+HbMAvjXRGJ4AW9jJ/nXWaT4j0zXrdZtOv7e9iYZDQShgfyqJ0KtNXnBr5EypVIq8otGlRSZ9KN1YGQtFJSFqQDqTmvn/4/ftDa58J/F1lpGmaZZ3kM9mLkyXJYHO9lwCD7Dt+NeZTftreLFXI0HSyP+uj+n1FfQYfI8biacatOKtLbU9WnlmIqwVSKVn5n2bn2pa4rwr42vNe+E9j4nlgijvp9MF60MefLD+XuwMnOM+9fOen/tg+Lb2KNzpOlruUdC45yexb2rmw+V4jFOcaaXuuz1MqOBrYjm5FtufYFLXz58GPj54i+I3j8aHqVnp8Fn9jluN1vu8zcrIAOTjHzHtX0EvSuXFYSrgqnsqu+5hiMPPDT5Km4tFFFcZzBRRRQAUUUUAFFFFABRVLWr5tL0i9vEUO9vC8oVjgEqpIH6V8k2f7cmuXEKsfClizY5IvWUE5I4G0ntXpYTL8RjlJ0Vex3YfB1sUm6S2PsOivmD4c/tba144+IGieHpvDdnZwX0zRvPHdNIygIzcAqv8AdFfT3essXg62CkoVlZszxGGqYWSjUWrFopKWuI5QooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigBKyfFMYm8N6oh6NbSA/Taa1qzfES/8SHUP+veQf8AjprWl/Ej6o0p/HH1R+VXhe0ijsYtsca/IMkIoJySeTjNbd0qquMADr90Vk+G5D9hh4/gX+Wf612/w78PW3jr4haJ4eu5pre31CVonlt8b1AjZuMgjqvoa/d51vZpzk9Ej9aqz5byb0SOWESsoYEH/gIp6QpjJx/3zX1r/wAMO6QuAnirUsf7UEZqRP2I9JUYPijUT/2wjr53/WPA/wAz+5nif21hf5n9x8jeTFJwVUjrygP86VbeHkCOP/v2v+FfXH/DEek5/wCRo1H/AL8x0n/DD+jE/N4n1Ij/AGYox/Sl/rFgf5n9zE85wv8AM/uPnf4B28cfx28HMIowftj4IQD/AJYyV+kHavn3wX+yHpfgfxlpHiG21++uZ9PmMqwzxpsbKMpBwAejV9A/zr4nPMbRx1eNSi7pI+YzXFU8XVjOm76DqWojIqtgsAT0GaUzKP4gPxr5yzPE1JKKYrhsFSCD0xUF1qVrYR+Zc3EVun96Rwo/M00nJ2SGk27ItUVzMfxK8KyXn2ZfEOmtP/zzFymf51v295DdRiSGVJUPRkORVypzgryi0XKnOOslYnopobNOrMzCikpN1ADqKpX2tWOlxh7y8gtV/vTSBR+prKh+Inhm4ufs8evac82M+WLlM/zrWNKpJXjF29DRU5yV1FnRUVDDdRXCB4pEkU9GUgg08yBeScD1rPUizTsx9FR+aP7y/nTlkVuQc0hCt0r4K/bOuGX46RIOF/sa3P8A5Emr71618C/tofN8eox/1Brf/wBGy19bwv8A8jDX+Vn0vD6vjPkzyjzP3eDzx/Sv0Y+Bp3fB/wAIH/qGQ/8AoIr84JxtgyOuP6V+jnwL/wCSO+Dv+wZB/wCgCvZ4o/gU/X9D0s//AIUPU7qT7nPTFfmX4w1S1PjnxK3nouNTuhtyQx/etg9K/TRvuishvDeiPK7nTbF5HYlyYEyTnJJ465NfMZTmay2U5OPNzI+fy7HLBObcb3R+WWvavbrC5aZWHQDc3J/Kv1V0CQXGiWDr91oEI/75FVpPC2gMuJNJ08qePmt0x/KtiNQgCqAoHAA6VebZssyjBKHLyl5hmCxiglG1hVp1MPy0F9vUgfjXziPFH0Vi6p4y0TQ+L/VrO0OduJp1U5+hNQ2Pj7w7qbbbXXNPnbrtS4Qn+dbeyqNXUXb0NfZVLX5WdBRUcc6TKCjq4PQqQc04NWW2jMhTXwZ+2pMyfHK0AOANFt+hI6yzf4V9596+Cv22IifjlaY/6Atv/wCjpq+t4Xt/aGvZn0vD6vjbeTPJlkZoT8x5Hc5/nX6Ffs+Y/wCFNeFeMf6GD+pr87mfy7cnPIUn8gTX6Hfs7tu+DPhX2tFH6mve4p/3am/P9D1eII2ow9T0cUtVL3VLTTY/Mu7mG2j6b5nCj8zWBH8UvCMt8LNPEmmNcnpGLlM/zr85jSqTV4xb+R8TGnOSuotnVUVBb3kN1GHhlSZD0aNgQfyqXdmsno7MjZ2YtY3jGMS+FdYQ/dNnKD/3wa2Qax/F52+FdXPpaS/+gGtaX8SPqi6Xxxt3R+X+j2UFrboIokU7cbggBPJ74q9LGpTkd/QVT06dWhTH9wH9WrtPhf4ds/G/xB0bw9fSTQ2uoSPG8lvgSLiN3BBIIHK+hr93qVvYw55vSKufq9Wp7NOTeiRyXkLtORj3wKalqrHnH/fNfYX/AAxD4Y/h8R64B6Ewn/2Snx/sTeG4+niHWT9fJ/8AiK+efEmBvpJ/czwHnOGfV/cfIH2VFU4A/wC+RS2F5daPcrdaddz6fcocpJayFCpzX1Z4o/YttF0mU6Fr921+BlEv1Ro24PHygEV8napZ33h/Wr7SdSgaz1GylMU0LdQezA+hFerg8xw2ZQkqT5rbpo78LiaOMi1B3t0Z9OfAH9qu8vtYtPDPjF1kkuH8qz1PIBduyye5559q+sV+b6V+U91bllEsZ2TRkOki8FWHII/Gv0s+E+v3Hij4beG9UutpubqxjeUpnG7GD1J718FxFl1LCyhXoKylo15nzOcYOFFxq01ZM66mkAihvWm+Yoxk49ia+LPmt9D4k/bMvt3xi0y2VJiY9IQkojEcyvxkD2rxkss0UgeOUKFOcpIOx9q/Ti4sLK4mE09vDLIBt3yIpOOuP1NIdHsJF/487fHX/Vj/AAr7fB8RLC4enQ9lflXc+joZv7GnCnyfCec/DeZf+GcdGkBIUaAPvAjpFz718H+H9Uge1iYyhgqjOd4OctkY2/Sv0+S3jSFYVRVhVdojAAAGMYx6VTXw/pka8afagf8AXFen5V52BzlYOVVuF+d3ObCZj9W5/dvzM+O/2U9QhuPjTEicyNpNwTt3YHzxeor7WWs+307TbaYTQW1tFKowHjRVbntmrazIWwrqT6Zrz8yxn16v7VRtol9xx4zEfWqntOW2hNRTdxoBNeUcI6ik54qOa6it1LSSLGo6ljgCha6Iau9iWiuZvviV4W0uUR3fiDToHJwFe4TP86u6f4w0TVcfY9Ws7nd0EU6t/I1s6NVK7i7ehp7Kpa/KzZopu4HpSisTIy/FRx4a1U/9Osn/AKCa/LzST/o6gdMZ65/iNfqF4rP/ABTGrf8AXpL/AOgGvy20eQ/Z1/3f6tX6Fwt/DrfI+yyFXp1PkenfAT/ktvhH/r6f/wBEyV+iH8Vfnf8AAJg3xs8I9z9qf/0TJX6Hbsc54rzuKP8AeYf4Thzz+PH0HUtZWoeKNI0kkXup2do3pNMqfzNJYeKtI1XAstTtLonoIplY/oa+T9lUtzcrsfP+zna9ma1FNDZxgilrIzFoprZ7UuaAFopm7n1FZ+qeJdK0RN9/qNrZL0zPKqfzNVGLm7RVxxi5aRVzTorlrT4oeE7648mDxFpskn90XKf410UF5FdRh4JUlQ9GjYMKqdOdP44tfIqVOcPiVieim5pc+lZkC0U3NM+0Jkjev50bgS0VEbiNSAXUZOBk09iexAoGOorK1jxRpXh+Ey6lqNrYxgZLXEqoMfiaXw/4k03xVpyahpN7DqFk5IWaBgykjqM1fJNLma0G4SS5mtDUopozTqgkSs7xD/yA7/8A693/APQTWlWb4g/5Aeof9cH/APQTWtL+JH1RpT/iR9UflZ4ZP/EugP8A0yX+Qr0n4Cru+Ofg846Xbn/yDJXm/htdumw/9cl/kK6/4e+KYfAvj7RvEM8ElzFYTGR4o+pBRl4/76r9uxEJVKU4R3cdPuP1nEQlOE4xWrR+mYpfyr5cm/bp0yMkJ4R1B/Qm4QZ9+lQ/8N4afnnwffj/ALek/wAK/KP7DzF/8un+B+crKca/+XbPqn8qPyr5Zj/bs0x2w3hHUAP9m4Q/0p837dWlxqSPCWpNjk/vk4H5Uv7EzD/n0/wH/ZGNvb2bPqKjFYngjxQnjTwnpOtxwtbpqFslwI2OSu4Zxmtv2rxpRcW4vdHkyi4txlufFP7dt1qVl4+8IyWOq6hp6tYzhktLlolbEicnBrwyHxTr72rI+v6rtwfmN9KSODz97/Oa93/byXHjTwgf+nK4/wDQ4/8AGvnKNwq88j3+lfsWTQpvLaMpRTfofqWVwpyy+m3FXPq+1+P03wy+AWgW9vMuq+LrmErHHM5fyxk/vHJPbjjPevmLxH4k13xvqEl74g1q71WXccLJKRGnsqjAxVjwR4X8QfEbxBHo+gWj3dxjdIWb5IUP8bHsORxXvtv+w/4gmtVefxRYwz7cmJbRmUH0zvH54rK2XZPUlzyXPJ389TB/Ucsk+ZrnZ8zC0hGVEagEdhz+fWur+H/xE8U/DfVIbnQdUuEhU/PZzOZIJFyCQVP0HQg1d+K3wY8UfCGaGTWbdJtNmkEceoWxLRbjwFbP3ST61zNiomjbPXnKnt2/MEfyr15yw+Lw/OrSizvnKjiKPOrSiz9F/g/8UbH4seEoNWtR5Nyp8q6tWPzQyDqCP1Fd1Xwr+yD4yk8M/Fi40iaYrZa5Cy+Wf4rhACrfXaHr7nLHtX5BmuDWCxLpx+F6o/N8xwqwtdwjs9ULIwVcnoOtfJ3x4/a2uLPU7zw14FeN7i3Yx3mrsgdI2wRsi5wWH945HHSux/bE+LE/gH4fpo+mTGPWtbLQIyHDRQgfvJP1A/4FXw3plrHb2sQBKxgE5+vOT7n3r6fh/J6VaH13Eq66Lv5nt5RlkalP61XV10Rq311qGu3D3mtaleaveOctNeXDOT+GcAewFUJLO3Zm+VQfUDn8+tdR4D8B658StZOlaDZ/aJ1AeaZmxHboSOWPc8jivozQf2GLJrbfrfia7+0n+GwjVFHt8wbNfX4rMsFl75KskvJL9D362Ow+Ely1Gl5JHzp4E+KPi74b3cU+i6xcmBDzY3UjSwOP7pUnjp1BBr6I+K3xaHxY/Z0fV9KubjRtVtbqH7ZbwylJYmyVYZB6EHIqh4v/AGK77TbSWbw5rhvyi5W1vowrMfZ1wP0r5yvX1Dw/dX+j3Yms5kk8u6tZOOQeM+vSvMhTwOb1I1qDXPB323XmjnjHCZjKNal8UWWG8T+IWSXf4g1Y+/26X/4r2FfUX7Dd9e3mi+LmvL66viL6PabqdpSvyHgZPAr5OkkHlMR7mvqv9hJ92g+Lz/0/R/8AoBrLiCEFgZuMUtUYZvGP1abSS1R9TelfBX7Z0OfjtE//AFBrcf8AkSWvvT3r4T/bK4+N8R/6g9v/AOjJa+X4X/5GH/brPF4f/wB8+TPFbkfuMex/ka/Rr4EnPwb8Gn/qFwf+gCvzluG3R8+n9K/Rz4FqF+Dvg4dhpkP/AKCK9rif/d6fq/yPSz/SjT9TuT901+cHxe1bVrP4z+MI4NZ1KCJbw7Yo7yRUX6AGv0gKgjFfmp8bMr8cPGI7fbP6V5nCsYyr1FJX905uHIxdapzK+hy2o6trdxc24bW9UYechAN7If4h71+pmnZFlbhjltg5PXpX5bKoa/tQecyoP/HhX6l2f/HrF/uituJ1FexUUluXxBa1JJJbjdSvrfTLG4u7qVYbaBGlkkc4CqBkk18CfGj9qLxH8TNUubHwxfT6D4WjbZFLb/JcXoGQzlsnCegAHWvpH9sTxE+i/Bu7sopWim1adLIFepUksw/FVNfCdnbC3REVQQvCjsBngfQAH866OG8uoypvGVo8zvZf5nRkOBpuk8XUV3eyFhtkjZnkJkmf5maVi7MfcnJpZYRJkqNm3n5Qwx78Cvpr9mn9nXw38QfB48S+JFfUkuJpFt7VZCiIqtjcSuCTwe+MHpXrmrfsj/DbUo3EOkTafOVws9rdSBkPqAxI/MV62Jz/AAeGrOi09NHpodmIzjD0Kzptbb6Hxd4V+JHjDwVNHLoviK8gRRjynnMsJHXBR845A6YPvX1T+zv+09qPxM8Rf8ItrujtHqyWzXP9oWan7O6KVGSCSVOWHevOPiP+yD4g8LW91f8Ahq6HiK0hRpBZzKFumwM4DD5WP4CvZ/2VvhavgfwHDqt/ayW+vawBcXSTqA8XpH7YHWvKzjE5ZiMI6tNJze3Rr1ODMK2BrYZ1YpOT27o9tU5brx6V8L/tqIP+F12TdzosP/o6WvulcDivhL9tmby/jZYL66ND/wCjpa8jhf8A5GC/ws4OHb/Xf+3WeF3jkRtzj5W/9BNfVcXx+Hwr/Z58J2WlLBd+KLq1CxQMcrAuTl3Ge2Rx6mvlnAZS5429/StXwf4P174g69FpGhWD3l7t/eMW+SFD0ZieAP8AEV+hYzCUMVCLxLtCDuz7DF4eliEpVnaMXcg8Q65rHjTUpL3XtXu9YuCxx58pMaeyqMAflVD7DEqgLGq/RRn86+lrH9iPxBJZo9x4lsbefbzCLZmUH/e3D+VeS/E/4PeJPhFPE+twrJYTNsiv7bLRFuwY/wAJIB6+lLC5jga01RoTV+y0OehjcLVn7KlJGd4B+Inib4b6lHdaJqc0MQPz2srmSCQZBwyk+3UEGvvj4P8AxSsvix4Rg1a1XyLlT5dzat96KQdQfbuK/OpstGQp3L91/b0H9fwr2X9j/wAWzeH/AIrXGlyz7LPWbdl8ts/NOmCpHvtD142f5dTr0J14q04/kedmmChWpSqRVpRPuusbxp/yKOtf9ec3/oBrZrG8ZDd4T1kf9Oc3/oBr8vo/xI+qPhafxx9T8stFctbqT/cH82r0/wDZ9Yt8cfCH/XzJ/wCiJK8t0nMdsg7bf6mu0+GHiy38CfEHRfEN3BNc29jK0jxwAFsGNl7n/ar9zxdKVXDzjBXbX6H6niISqU5RitWj9NfSjmvmb/hufw9wV8Ma0y467U/+Kpp/bq8P9vC2tfj5Y/m1fkX9i5h/z6Z+ef2XjP8An2z6abNfn9+1y9q/x3vPshjbFjALgxnnzMtgH32gV6F4s/be1HULGaDw94dWxlddqXV9Nv2/8BAAz/wI9OlfMWqahdatq15qV/cNdXl1IZZbhyMsff2FfY8P5RicHWeIxC5dLWPp8ny2vhZuvW00tYfPeLbwsWI2qpJ/p+uB+Nfo98CtPm0r4Q+FbadGjlWxRmVuo3fN/Wvi34B/A3U/ix4qtrq/sbm08L2colmuZU2i4KkERpn1ODnHQGv0JhhS3hSKNQsaKFVRwAAOK4eKMXTmoYaDu1qzz88xEJctGD1WrJM8GvgT9rLVtW0/496gtnrWp2kX2G3Pk295JHGODyFUj0r77Ar89v2wpCv7QN+o6f2fan8w/wDhXBwvGM8fZq/uv9DHh+Kni7NX0Z5vqXiLXprORT4g1j7jHP8AaE3Hyn/ar9GvgjLLN8JfCbzyyTSvp0LNJKxZmO0cknrX5rTMWhYHupH5giv0m+BvzfB/wee50yA/+OCvb4qhCNCk4pLU9TiCMVQp2SWp3VcX8avM/wCFTeLzDLJBKul3DLJC5VlIjYggjp0rtOlcj8Xo9/wt8Xj10m6/9FNX57hv40PVfmfG0P4sPVH5k6XrWux2yJ/b+rHjkm+kyeAPWvc/2Orm/uvjV/pepX10n9nTHZcXLyLncnOGJGa8LsIiq8+n+Fe7fsb/ADfGU/8AYOm/9CSv2TOKdNYGtyxW3Y/Tc0jFYapaK27H3eO1J05o57cV4z+1B8Yn+FPgXy9Pkxr+qM0Fmq4JTj5pMegyPxYV+OYXDzxVaNGnuz8zw9CeJqxow3Zh/tAftTW3w3kk0Pw1FBq3iQD94ZHxDaccF8feb/ZFfHvifxt4r+IF4934h8R32oB+RbJIYoE9lRccfXn3rCt1kdnmllYzOzSSyuxLO55LE9z1/Oui8BeC9c+JetNpXh+ya5nXDTyM3yQKe7H8elfsGFy3B5XR5mk2t5M/RsPg8Pl9O9k2t2zHtbaGMYEaf8CG7+eanWARtvhLW8gOVeJ2Qg+2DX1T4d/Ybsha7ta8R3hujj5bFEVB7fMCTXL/ABE/Y91/w7ZzX3hi9GvRx8/YZ1EczDuVYHBPtjmsKed5fUq+zU/vWhzxzPCTnyKRxfw3/aU8Y/Dq4jjvLqXxHpO757e6fMqr/wBM2459jnrX2v8ADb4maN8T/DsWraPPvU/LLC3Dwv3Vh61+dek6Xdatqv8AZVpaSzayJPL+xqn7wNnow/hx719h/s7/ALO1x8NdQfxJqepXC6tdwGOXT4HH2cAlTlhjlht6g9zXg8Q4XAxh7RPln0t1PKzejhox59peXU9r8TASeHNUUnrayA4/3TX5W6Lcf6HGT1KA/qa/VHxR+78N6oR1FrJ/6Ca/KjRYz5QUdFGPyJquFP4VZvyNuHl+6q/I9N+At+tr8bPCcsrJHClxIXdzgKBBJyTXoPx2/ac1fxhe3ei+FbqbSNFt5GifUIDtmumGQ21uyc+mTxz2r581FfKgcklF2/M2SAB6nHNelfCj9nHxn8U7H+1IVh0XSJDiGe+BZpVHG5VGOK+lxWGwcaqx2Ka91WVz2K9DDRmsVXey0uedC3V5GmnLXEz/AHpZmLsx9STSrCY5UktpZYJ0O5HikZCpA6gg8V7/AOIP2K/F2laa8+naxp+rTKMi38toSeD0JJHXA/GvBLyyvNF1a603UrSWxv7Ztk9rMMMnp9c8812YbGYXHJ+wknbp/wAA3w+IoYtP2TTt0PoL4B/tQaroOrWmheL79tR0q4ZYoNRuGBlt3PAWQ8ZX3NfaUTrLGHU5VhkYr8rb23FzbsrAHfgHgDv/ADHUfSv0B/Zm8VXPi34O6Fc3chmuoFa1kkbq2w7QT74Ar4HiLL6VLlxVFWvo0fJZxhIQSr01boz1M9BWX4i8Rad4V0a61TVbqOzsbdDJLNIcBVFajZxmvgL9sD4tXXjzx9L4Qs5z/wAI9ozfvo0yBPc4wdxB5CgkAf7RznjHz+U5bPNMSqKdorVvyPKy7Ayx9b2eyWr9DT+LX7WHiPx1NcWPhGeXw/oecJfRgC5uF5GVJyFU/TPA5614W6S3l29xe3U19dyffuLucySN+LH9KbDKtvGq52g4UDGcHoOPrX078I/2PW8QaZHqvjK4uLJZsPDp9m4V9v8A00Yg9fQY+tfqNSWAyWhskvTVn3NSWEy2lorLp3Z8zNaQbCPLUDPcVu+D/H3in4e38dxoGt3VnGp5t2cyQOMg4ZT24HTBr7K1P9jvwDdWLRael9ps/aZLlpecd1ckflg8da+U/id8J9V+D/iJbLVWW5t7jc1ndxqQkmD90+je1ZYPNMFmd6PV9GtzDCY/DY5ul+DPrf4E/tHWXxSUaXqcK6Z4ijQkxZ/d3AHVo+f0617VX5a2+qXmk3VvqGmTPZ6haOs8NxE2CrDnj8iD9a/Rb4PfECH4meAdM1yPAllTZOgGNkq8MMfX+dfDZ5lMcDJVaXwP8GfL5pgVhpe0pr3X+B2bD5T7ivzA8b6xqy/EzxYF1nUlX+1bkKgvZAqgSEYA3cdBX6gNX5c+PojH8TPFY/6ityf/AB/P9a9DhOMZVa3Mr+71PV4ajGU6qkr6FjQdU1NvFGg79X1B1/tG2yr3cjA5lUEYz6E19c/tNftEyfDi3j8O+HWifxLdR73lk5W0ix94jux7D8a+NrG9fS9RtLyMK0tvKkyK4ypZWDDP4gVN4k8Q3finxBe6xqMxlvbt980mQBgdBz0UDgV9VXyuli8TTq1EuSKendn0FXLqeIrwqTXuxT+ZTv76+1+6e+1m8uNUvJmLNNdtkspPHyjj9K+6/wBkONI/gnpYjVVXzpgAowPvmvjLw/4F8QeMv+QLot3qQPJmijwvUcbz1r7c/Zg8M6z4R+FFlpuuWD6dfRzTFoJCCcFiQeK8TiSrReFVOm0mnsjyM9q0nh1CFtHsj1ulpBS1+aHwYVm6/wD8gPUP+uD/APoJrSrM8Rnb4f1I+lvJ/wCgmtqX8SPqa0v4kfVH5ZaApbTYMf8APNf/AEEVZuUKqx9BmoPDjL/Z8Iz/AMs1/wAP6V33wVs7XWPjH4Z06/tobyyuZ3SWGeMOrDynOCD7gV+4zrewUqj2ir/gfrlWqqd5v7KOF8yHaCXU8ZwCCP6mmeZEecqPy/rX6Nn9n/4bPw3gfQm+tjH/AIUqfs/fDeP7ngjQ1+ljH/hXyX+tVC9/Zv8AA+X/ANYKV78j/A/Oq3jSRuqn/dx/jUl1DFGhLsEXB5Ygdj71+iq/Af4er08G6KPpZp/hSTfAX4fTLtbwhpIH+zbKv8qX+tNG/wDDf4DjxDSUr8jD4DSK/wAHfCBQ5X+zolB+i4/pXefxVU0fR7Pw/ptvp+n20dpZW6eXFDGMKi+gq3/FX53Vn7SpKa6ts+Jqy9pOU11Z8Xft6f8AI5eEP+vK4/8AQ46+bXYrDkHGO9fR/wC3s5Xxr4OA72Vz/wChx186+QWhHGeP6V+w5K7ZbR+Z+n5ZK2ApfM+3P2L/AAXZaH8LV1qOLGoatM0s8hweFJVVHoAK+gcD0ryz9mG3Fv8ABfw8ozjy2b82Neq1+V5lUlVxdSUnfVn51jpupiZyfc5L4qeDrLx54B1vRr+LzILi2cDplWAyrA44IIBr81dDY/ZQCRkKF/EDB/UV+p2pLnT7gf8ATNh+lflhYnbcSqAAN7D/AMeNfX8MzlKjWpX00Z9PkMpSoVYeh6B8EG8n4z+EXUZb7cBz/tKyn9Ca/Rcivzh+C8hX4yeER66jGP51+jzfMMd687iVWxFP0ODPV+9p+h+ef7ZHiBtc+P01j5peDSdPhhVOytJl2/Qr+VeVXE/kwcYHOenU8Y/lXaftNWc1n+0r4u84YFwlrNH7r5Kr/NTXE3mBGCSQB8xx6Dk/yr9EwEVDBYdL+VM+3oxUMLQUekT9CP2Y/h7a+A/hdpjCHZqWpRi8vJT953bkfgARivWzXNfDfV4Ne8B6Bf23+pmsomUDt8o4rpa/F8ZUnVxFSdTdtn5ViZynWm573Ebt2r47/bk+HcGmzaP42soVjeaX7Df7V+/kZjcn22kfiK+xT1H+FfPv7bmoW0PwWlspTi4vr2COD13K28n/AL5U/nXpZFVnSzClydXZ+h35TUlSxkOXroz4oVt1q3zZIHOPWvq/9gxs6H4xHpfRf+gGvkuEqLVtuMNljx6k4r61/YMX/iReMD630X/oBr7viFf7DUt3R9VnCf1WfqfVXrXwf+2Y/wDxfGNfTR7f/wBGS194etfAv7ZkxHx9C8Y/sW2/9GS18pwv/wAjD/t1nh8P/wC+/JnkbKGTBr9HfgZ/yR/wh/2DYf8A0EV+cW75Riv0c+Bf/JH/AAh/2DYf/QRXt8U/7vS9X+R6nEH8Gn6nd1+avxyUr8cvGP8A1+/+yiv0qr83PjpCP+F5+M85/wCPsEf98LXl8K/7xU/w/qcnDn8ap/hOLeby7q3YdVlQ8/7wr9T7HmzhP+yP5V+Ul8xSeIj/AJ6J/wChCv1bshi1iHYKK24n/wCXPzKz/an8zwv9tTw/NqvwXutQt0Mk2kTpe7R3UZRvyD5/Cvhi3kF1a7kbcGO5WU54OCP61+q+qaba6zptzY3sKXFpcRtFLFIMqykYINfCfxY/ZT1/4d6nc3fhaym1vw2/zrHbgG4tuSdrJkblAzgr+Vb8OZlRp0XhKrs73V9jXJMwpwovDVHZ3ujI+CP7QWu/BmGewNp/bOgySGU2jOEeAnqYz0wfQg19UeB/2rvAnjTyon1A6PesMm31AeXzkDAboTzXwytujMyEmKVSQY5V2uMf7J5z7VXuLJo2YMFIz0POfrkcGvdxmS4PMJuo/dk+q6nrYjLMNjpObVpPsfqXa31tfwrNbzRzxOMq8bBgfoRU64FfmT4N+I/iPwDeLcaHq1xahf8Al3Zy8L98FWzxwOmDX2n+z/8AtBWnxetJtPvUWx8S2aBp7UDCyLwDInJ4yR3718LmWR18vj7RPmj+R8ljsoq4OPOneJ7LXwL+3I/l/HLTffRYT/5Glr755FfAn7cmW+OumADP/Ekh/wDR0tdXC3/IxX+FnTw7/v3yZ400whg3Zwo5Nfdf7Ifw/tvCvwvttXKBtR1om6ml6naThQPbFfCs0Alt9p6FSD+IIr9IfgLGI/g14PA6f2bD/wCgivoeJqsoYONOL0lLU9bParjh1GL+J6ne8elcj8WvCdp40+Heu6XeJujltXKkAZVgCQRkcHIrrtnTmqOvKG0PUF7eQ/8A6Ca/NqEnCrGUXqmj4ejJxqRku5+WmlXHnQrvYM4Ta5AxyCR/Su/+AP8AyXLwf6C8Y/8AkKQf1rzfSP8AVEevzfmTXpvwAg/4vZ4Sb0umP/kN6/aMw/3aq+8T9Mxn8Ko+6P0XFZHi3/kV9X/69Jf/AEA1rCsnxcdvhbVz/wBOkv8A6Aa/FaX8SPqj8yp/HH1Py00+PdAgHp/7MasXFuvlnOCeoDYP86raPL5kAPfb/U16T8B4Yrz4zeFra4ijuLea4dZIpkV1YeTIcEEeoFfu9at7CDqNX5Vf8D9VrVVTjz9kecR3lsIyN8LN1+8oojuoXJw0YOP4WT/Gv0//AOFceFGGD4a0g/Wxi/8AiaT/AIVt4SHTwxo4/wC3CL/4mvilxXTTv7J/efNR4ggv+Xb+8/MOOaMsRvUj0yv+NQ3k3l3cbIVeSMqyK209Oelfp3efCrwbfQtFP4V0aWNuqtYx/wDxNfL/AO1L+zPpXhXwrd+L/CMD2Qsist7pyMTEYc4dkHZhwfpmvTwXEmGxdeNKcHFvTuj0MNndHFVo05xcblb4W/tq3ejyRWHjDTbU6aCscd7pqMjRDIGXQk5A55GPpX2Lo+r2evabb39hcR3dncIJI5omyrKe4NflJYsJkXnK9C2SQOccZ7Hj9a+rP2H/AB1c293qvgq6maSFYvt1krEnYN22RRz0yykD615nEGS0qcJYnDqzW6/U8/N8thGMq1LRrc+vK/PD9sSQ/wDDRGor2GmWZ/8ARlfof2Ffnl+19CZP2itSJ6f2ZaD/AND/AMa8nhX/AJGF/wC6/wBDj4d/3x/4WeVt80P4V+k3wL/5I74O/wCwZB/6CK/N7yxtx2xX6R/A3/kkPhAdv7Nh/wDQBXtcVP8AcUvV/kenxD/Bp+p3Lda5P4uN5fwt8XN6aTdf+imrqya4z40SbfhJ4xbPH9k3X/opq/PMN/Gh6r8z4vD61oLzX5n5sWuHhBHoDXt/7HEZX4yE/wDUOm/9CSvCdDk863jz129vpXv/AOx8o/4W9/3Dpv8A0JK/Ys4f+xVl5H6dmj/2arHyPuPtX55ftb+JpvE3x4vrFixttFto7VAegZ1WRiPxP6Cv0N7GvzW+PSn/AIXv4xEn3/ti/l5SY/SviuFYxeMlN7qJ8xw3GP1mc3uos4y6mFta4UKCB8o9+364r9B/2cvhjafDX4dWCJAE1TUEW7vpeNzyMM9fQZwBX553jDzoN4zGJYy303Cv1W0llOm2pTBTylxj0xXo8T1ZwoU6Sekrt/I6M+qShShTT0b1LX86U80lLX5zofEnM6d8NfDek+MtQ8V2mlQw69qESw3N4o+aRVxgHt2HPtXTfdo/GjmrlOVSzm7lynKfxO5l+Kj/AMU1qv8A16yf+gmvyx0VR5ec9ef/AB41+qHidd3hzVFPQ2sg/wDHTX5V6Gd0Sk/3c/qa/Q+FNaVf5H2XD7tSq/I7DwF4Tg8c/EXw/oNyc2t5dKsy5+8gBYj/AMdr9LNO0+DS7KC0tYlht4UEaRqMBVAwAK/PH9n75vjn4SJ7XT/+iZK/RfHevP4oqSlXp029Ejhz2pJ1IQvokGM96+MP24fCFpo/ivw54mt4BHNqEclncyL/ABldrIfrjcPwFfaGK+Xf28o93hHwo3camR+cT/4V5nD9SVPMqXK99PwOPJpOOOgl10PlVSGt1b8a+1P2NpC3wuu4/wCGPUpQo+qI38ya+KYfltOfQ19nfsWyeZ8NdU9tUkH/AJCir6ziFf7HJdpH0OcR/wBlfkz2L4geIF8J+CNd1ljt+w2U1wCfVUJH61+XENw19NNeTOzzXUr3EjtyWZySSa/Rb9p2R4vgD46dPvLpcx/DHNfnFpreZarsIOBj8MAip4VpqOGq1eraX4F8PQSwtWp1bSPXP2W/Btj45+MFsupxK9lpkD36o5BV5FZVUEdx8+fwFfoQt1AuAJU9uRX5MyQsjF4yydmZasWMKHLCXJxjr/8ArruzbJJ5lUVf2lkltbY3zHKZYyaqc9kuh+rzXsCctOg9twryj9pzw7YeMvgz4gUvG15YW7X9o4YZWWNSw/MZH0Nfn95wib5ZnQ+qMw/kKJtUnihlSO9nRZUMcn71vmUjkHNebheGalGtCtGrqnfb/gnDQyKVGrCaqbMh0uY3VsCylVwSQTzg5P8AjX1v+wvr0oi8V6FITsjliv4we3mblYD2+RfzNfJ2k+T8wBXkEAZHH6+9fSn7GEhX4iawsbho3047hxnIkTHQ9txr2OIUqmFqprazO/NoqdGrptqfZhPymvzH+JSqvxQ8VAf9BOc/mwr9N+1fl78QLhrj4qeLdwAxqtwvHswr5zhP+JWf9083hn46z8jKugUXdjPtXtP7LvwJh+Kl5P4h1+Bm8PWcmyCE8C6lGMk+qDnjjnHNeLX2+aMwxkCVvkT3Y8D+dfpn8OfCdr4J8E6PotpHsitbdUxxktjLE475zXtZ7mE8HhI06btKf5HpZzjZYbDqFP4pG1pul2mk2cVpZW0dtbRDakUaBVUegAq3QF6UuPevyltyd2fnLbbuwFLSUtIQlZniXnw7qf8A17yf+gmtM1meJD/xT+pf9e8n/oJrWl/Ej6o1pfxI+qPyp8LSGTTYGPUxr0/P+tenfAP/AJLn4PP/AE9v/wCiZK8v8Jqf7JtsdfLX+QrqvC/iG/8ABfijTte07yTe2MhkiW4QvGSVK4IBB6MehFft1ek61OcI7tW/A/VcQvaKcFu0fqBS/jXw0v7YXxIY/c0PH/XnJ/8AHKkX9r74id10T/wEf/45X5t/q3jvL7z4P+xcV5fefcP40fjXw237YHxG5wuh/wDgI/8A8cpg/bC+I5zkaGP+3N//AI5S/wBW8d/d+8f9i4ry+8+5/wAaT+Kvinwn+1d8Qtc8YaFpty+kra3l/Bby+VaMrbHkCnBLnnBr7VXoCTzXkY7L62XyjGva77annYrB1cG1Gr1Pi/8AbyhMnjXwcR2srn/0OOvA4UVYgG9P6V9Cft0f8jh4QP8A053P/ocVfOE8zKo6f5FfqOTa5dRXqff5b/uNK3mfoX+zY4f4O6BjoI2H/jxr0+vJP2WZTN8E9BZuu1xx/vmvW6/Kcbpianqz87xX8efqV9Q/48Z/9w/yr8qbOU/bLgekj/8AoRr9Vr7mzmH+wf5V+VYtTDql+n8KXEqj8HIr7LhXasvJH1fD3w1V6Ha/B5j/AMLi8HMOv9pw/q2P61+knPNfm38GYy3xg8IZ6f2lCfybNfpJ16Vx8T/7xT9Dhz53qwXkfEv7c/gGTTfG+heNIlY215b/ANmXOcbVkUl4+3GQZASc9F6d/nmTdJDkdhzx+lfpx8Tfh/p/xN8Fal4e1JN0N1GQr4GY3HKsPQg1+bPizwvq3w28S3Ph3XoWW+iO5JNvy3CdnQ9+McV9Jw7j44rDLDzfvw280e7lONjiMOqLfvw280e/fss/tHad4L01fCPiu7eG135sL+QEoN3/ACzY9gOcGvsaw1S01S2S5srmK6t35WSGQMp/EV+VckKzRqwZWU9B2P8Aj+lWNM1LVtFhdNO1TUbGNuTFZ3ckan8AwrLMOHaeMqutRlyN7owxeTwxU3Upy5Wz9NPGHxC8P+BNNlvda1S3sokHR3G4nBOAOpPBr4A+PHxpu/jJ4ujljV7bRLIFbO3Y8tk8yEep6fQ159eXEl05u72Z7qTp5s5aUn25+9z2Fd94g+CupeEfg3B461oTWl5d3kUcWnsACsDBjvfjIPAwPQ1vl2U4XKKkalafNOTsvU2wWBoZdNSqS5pvRHENlYMdgDX1r+weu3QvFnveQn/xw18jKxkt2I9Dn+lfXf7CKkaD4sJ/5/Ih/wCOGnxCuXATT7oecRccJNPuj6mr4A/bQ/5L8D/1Brb/ANGTV9/c18B/tnIzfHzj/oDW3/oyavk+F/8AkYf9us8Lh7/fP+3WeQNIVUEelfpD8CG3fB3wef8AqGw/+givzbmysfPp/Sv0j+A//JG/Bv8A2DIP/QRXt8VfwKXqz0+INaNP1O9r84fj03/F9PGIx/y8p/6LWv0cLYBr82fjvcl/j540TjC3SD/yEh/rXlcLL/aKn+E4uHf41T/CcLfpungX1lQH/voV+rVj/wAesX+4K/Ky6g3XEB/6ap/6EK/VOx4s4f8AcFa8T7UX6l5+7ql8ySRhHGzMQqrkktwAKitby3vrdZreaO4hf7skbBlP4ivBv2rPjJF4T8L3PhnS5kl13UIzHKiyYNvEwwWbHQnt+NfNHwh+L/iT4Qwx2ul3n2rSFyP7PvGLx5yCSp6gnnnOK8vCZFXxeEeJi7Pou55uHyitiMO68Xbsu591+LPhb4T8cL/xOtCs7x/+exTbKPo64b9a8T8ffsY6ZfWs8vhfVbjT7rGUt7w+dD9M43D65P0rX8L/ALZXhHUrcjWrW70O5U4Ksvmox9mX/CtfVv2uPh5YWckkWoXF5OF+SGG3csx9ORgfjSw9PN8HUUaUZXXTdBRp5jhqloJ3XzR8Mato2oeEdev9E1aEQ6lYy+VMqnK8qCCD6HNdH8G/EU/hP4veE76GVoY5L+K1m2/8tI5DsKn2+YH6gVX+IHiKT4hePtY8TSW4tDfupWHdkoiIFGffCg/nWj8DPC0/jr4w+H7G3QvBZXMeoXDqPuxxsGB9ssFGPev0rFSvg5SxCt7uvqfcV6n+zy9qteXU/SRecGvhP9ti1V/jbp0hzn+xYh/5Glr7sHy18MftqSZ+NFgpwMaNF/6Olr884Zf/AAoJ+TPjcg0xnyZ4ky/u/wAK/Rr4Ff8AJHfCH/YNh/8AQRX5v3EjJGcY6f0r9G/gCxf4M+Dyev8AZ8Q/TFe7xR/u1L1/Q9PPv4MPU9B9Ko64N2j3w9YX/kavVT1gZ0u7H/TJv5V+dU/jTPjKfxx9T8q9Gj/dnPY4/U16n8A2A+M3hQd/tTf+i3rzSyxGr4/vMP1rvPgHcMfjf4SXjH2s/wDot6/a8cr4Wdv5f0P03F60ZvyP0bHasfxj/wAinrP/AF5zf+gGtcVk+Lxu8K6wP+nOX/0A1+K0fjj6o/M6fxx9T8q9BJ+zqfVP/ZjXqn7PYx8bvCLHOftT9P8ArjJXl+iQmO2jPUbP/ZjXW+DfFF34J8TWGu6ekEl7ZOXjW5UtGSVK8gEHox6Gv3TE03WozhDdq34H6fiIOpCUY7tH6dilr4cn/bG+ITD5IdETn/n0kP8A7Uquf2x/iR/d0P8A8A3/APjlfmP+rWP8vvPiP7HxXl9591NXkH7U3iyy8M/BLxPFcOGuNStJNPtoQfmeSVSgx9Mk/hXzlJ+2F8R543jJ0aPcMB47Nty+4y5H6V5X4o8Uaz461AXuvapPql2OEaUgBBnOFUAAflXpYDhrEQrxqYlpRi76a3O7CZPVhVjOs0ktTk9Ht/s8KJx0APBwMDv685r3X9keaaX40acLdAVW0n85s9I9o/8AZtteO3ieTbscqqqMbm6KP85/OvqP9h/4a3NsdV8bX8Dwi8X7LY+YuC0OQS34lRX1ed4iEMFWlL7WiPdzLERWHqOXXRH1rXwJ+2BCIPj5dMf+WulWrDPsXH9BX332r47/AG7PBrW+peH/ABjGn7nYdNuW7Kc74znsPvjn/Zr4DhqrGnmMVLqmj5rIakaeNXN1TR81bd3yqcE9C3QfWvv/APZj8aWXiz4T6PDAQk+mxiymhLgspQYBP1AzX59Wsi3CZ+8ckEdPwNdV4D8eeIfhtrL6n4fvjayygLNC6h4ZgOgZfbHUYNfe5zl7zCj7KLtKOx9RmeFeMpezWjWx+mpxXi/7V/j+y8F/BzXbZ5EN9qlu9jbw5yxLqQTjPQDPPrivHv8AhtDxNNpZj/srTob0Ljzy7MpP+51x+NfPnjzxBrvxG1yfVdUuZtVvRGzKoyRFGBuIVQMBeP0r5XLOHKyxEZ4pqMYu/qeHgMmqRrRqV2lGOpi+H4zDCoPTaOT7CvoH9juZX+MJUdf7NmP/AI/HXg1kNsYOcf7I+p/pivcv2N/+SzPx/wAw2b/0OOvr85fNha/ofQ5lLmoVn5H3XX54/tZeHZvDPx8v7qTd9n1q1ju4i3TcgEbgfkv51+h+K8R/ap+C8nxU8DrdaWgbxDpJae1Xj98uPmiJ9+CPcCvzfIcbHBY2Mqnwy0Z8bk+Mjg8UnP4Xoz4RmhF1C2X8vIIyPccfrX6Bfs3/ABMtvH3w9sYpJlGr6fGttdwswLZUYDfQjFfn1ZzNuZWVoJoztZJBh0boQQehHI/Gt3wz4p1rwNrMer6FfNYXiHkqMrIv9xh0I+tfomcZaswo8ieq1R9dmWDWMp8qeq2P1C7+1ITj/Gvkbw1+3NPFarFrvhrzrhV5lsLgKGP+63T8/wAKzPGH7aWva5azW2g6NDo0cny/a5pjLKBgjAXaAD3zk9OlfnceH8fKpyclvPofGLKcU5cvL8z6yg8b6Dc+IptBi1W1k1iGPzZLJZR5qrxyV/EVtbs1+WtvqeoWWuNrtreTxa4z+Y1+pzM7epP+RX2L+zH8f9a+J91faFq+lyPNpsIZtYjGIpTlRtP+2ck8ehrpzLIamBpe2hLmit/U6MblMsNTVSErpbnuXihinhrVW7i1lP8A46a/K/Q1/crj0x+pr9T/ABVz4X1b/r0l/wDQDX5b6HGFhUjng9f9417PCrtSrN+R6GRu1Kr8j0j9n6Pb8cPCX/X05/8AIMlfoqK/PD4Bkf8AC8PCP/X0/wD6Jkr9Dua8vib/AHuHocGdfx4+g7tXzD+3cP8AiivC7dxqv/tKSvp6vl/9vOTZ4J8L++qkf+QZK8rI/wDkY0fU5co/36l6nyKsxNqRnsa+0P2H23fDXWPbVpB/5Cir4niVmgJxxtzX2p+w5uX4a61u/wCgvJj/AL9RV93xHFLBTf8AeR9ZnaX1WVu57Z8RvDcfjDwHr+iSBimoWM1t8pAPzIRxkdea/K3QVns4XtLiPyri3doJUYYKujFSPyxX65/eXmvg39rL4Oz+B/HsviuxiY6FrL5nYY2wXOOhwOAwBOT3BrwuF8ZGnOeEm7c+q9Uebw/jIU3PDVHpLb1Oc/Z51Dw/Z/ES1sfE+m2moabqKNaj7ZGrpFISGVzu4H3Suf8Aar7WX4EfDmRQ3/CFaGQeebGP/CvzhlXzo8fckH8APzA9Rg/r+FfQfwl/a71nwjYQaT4ptW1uziASK+RgLkKP+eg6Nj1GO1eznmXYqtJVsLJ36q9jvzfB160va0G79Vc+m/8AhQPw33Z/4QjQ8/8AXhH/AIUj/AP4bnJPgrQ1/wC3GMf0riP+Gy/h81o0iPqTyhc+SLNs59M9P1rxD4qftieIfGun3WkeF7BvDtnMCkl9KwN0R0+QdFz6818thctzXEzULyiu7b0PAw+BzGvNK7S7ts+oLP4G/DG8hL2vhHQZowxXdHaxkZBwRkD1re8L/DDwp4Lvpb3QvD+n6Vdyx+U8trAqMy5B25A6ZA/IV8HfAH46X3wFuJra8aS/8LzyGa5hkkZ3t2P3pUJPc9RznPav0F8L+JLDxhoNjrOlz/aNPvYhNDJtK7lPsRkVz5vg8Vl9T2dSblF7O+5jmOFxGDnyzm5RfU1DxX5b+OP+SqeLj66tc/8AoQr9R2+6a/Lzx1CV+KPi4j/oK3H/AKEK9vhNpTr+iPY4bdpVvQr6JGJPFmiI3KtqFupHqDKor9So+IlHtX5baDkeLtCJ/wCgjbf+jVr9SU+4PpUcU70V5P8AQz4hfvUl5DxS00ZzTq+GPkAooooASsnxa7R+GdVdFLstrKQqjJOEPFa1JtzVQlySUuxUZcslLsflN4P0LVG0uH/iUalGFjAxJZydiR1x7CthtI1BX+bTL38baQf+y1+ny26RjCqAPpS+Sh6qD+Ffb/60zvf2S+8+oefTcuZwPzGj0bUz93Tbz8LaQ/8AstNbSdSU86bff+Asn/xNfp55Kf3R+VHlJ/dH5Uf601P+fS+8n+3JfyfifmB/ZupHj+zL38LWX/4mhdI1H/oGXx/7dJP/AImv0/8AJX+6PypPJX+6Pyp/60z/AOfS+8X9uS/kPzX8C6df2/xE8KmTTr1FGrWp3NauAMSqTnIHbNfpVtphtomIJRSQcjjvUm3jFfP5pmTzKcZuPLZWPLx2NeMlFtWsfGn7cltfX3jbwlFZabfXuyyuGZrW2eVVy8YAJHfivnqTw3rZwf7C1bbjnNjIO30r9TzGrHJGTSeWvoK9XB8RTweHhQVNPl8z0MPnMsPRjSUNjyX9leGe3+C+hxXMElvMnmBklQow+Y9Qa9dpAoWlr5atVdarKo1a7ueDVn7Sbn3K98220mOCfkPAGe1fmOmhareajqMkWh6v5ZuptrNYSAMN55BxzX6f9aasar0FetlmaSyzncYc3MejgcwlgVJRjfmPzx+EGgara/FrwpJPpN/bxDUI8yS2rqo57kiv0PXikaJWxlRwc07bWWZZhLMakako2srGWMxjxkoyatYT8K5H4hfCvwv8UtMNj4k0qG/ReY5DlZIzyNyuMFTyehrqL25jsbWW4mkWKGJS7uxwFAGSTXyH4f8A26pV8a6vDqmjrc+Fjcsljd2RP2hI1OC0iE4b8MdqjAYPF4lyqYRO8NdNBYTC4itzVMOvhLfiD9hLyZt3hzxVJFCTkw6nbiQj0w0ZT9QT71jL+wz4nmYrL4p0yFf7yWkjn8iw/nX0h4U+PPgXxlHEdP8AENoJpBn7PcP5Uo+qtiuzTW9OcZW9tyOvyyA16v8AbGbUfdk3fzWp2rMMfT0d/uPFfhd+yP4X8BXkWo6lNL4j1RCGVrsAQRN/sRgcfiTXMft4a4tp8NdG0lZFE17qSsYv4vLRHJI/Er+desePvj54M+H1nNJeazbXN4gOyxtZBJM5wcDAPHTqa+Cviv8AE3UfjL42bXL+P7NbRp5NnZbsiCPOTn/aJxn6V6eTYXGY/GxxmKvyw1u/0O7LaOIxOKjicRtHucxDIYrNiQNxB619lfsM2rL4P8TXZUhJtT8tCehCIOfzY18Z3kjLiONPMkbCJGOrMeAB+Jr9IPgD4Db4dfC3RtKlz9saP7Rc5/56vyw/DgfhXscT1oxwig3rNnfnVZfV+XrJ3PRD0r4S/a5sb3UPj8Ra6ZfXSjRrcGSC1d0GJJOMgdfmFfd3UYphhUtux83TpXwGWY95bX9vGN3Zr7z5XA4x4Gr7WKvo195+X194V1fyWYaNqh+U/wDLlJ1wfav0I+BSPH8HfCCSI0ciadEpSRSrAhcYIP0rufJTGNo/KnKgUADgV25nnM8ypwpyhy8rub43MJYyEYNWsIea/Nn426bqN9+0B43a30jUpYxdR4ljtHZG/doDggc/dr9KMcYqP7PHuLbRuPU4GTXPleZPLKkqkY3urEZfjpYCUpKN7qx+X0ug6uskLHR9RC715e0kAHI9q/T2xb/Q4fdAf0qVoUbqoP1FP208yzN5jyXjy8oY3HPGKKcbWPH/AIxfs1eHfitcSaopbSPETIE/tGAZ8wAfKsinhgPXg+9fKHjX4A+PvAUkhudHbWLFflW80nMgYe6feX8c/Wv0P20hUN15HpWuBzrFYGPs0+aPZl4XNK+Gj7PePZn5VSTLb3UkFxG1vcL96KSMoy/XI/rVaS7h5IlXOcfK+T+lfqbfeGdI1TP2zTLO7LdfPgV8/mKoWnw78L2Ll7fw7pcDnq0dnGD/ACr6OnxVCOro6+p7Mc+UV8H4n53eC/hl4q8fTJbaNotxNHJybqdDHCi55JJ69envX238BPgXY/BvRrhmcXmuX5D3l3gduiLxwor1KC1htoxHFGsSDoqKABUm3pXz2Y51Xx69nblj2PGxmZVMVeNrJhXwN+2s15N8e7KO302+uoxokOZbe3Z0B82TjIB55FffWKi+yxtJ5hUF8Y3EDOPSuPK8weW4j26jzaNfeZZfjHga3tVG+jX3n5XT6RqrQkjR9TI2n/lzk9PpX6J/s/Ky/BjwkHRo3WxQFHUqRjIwQa9A8hOm0Y+lOWMIuFGAOgHau3M85lmVKNOUOXlZvjsyljYKDjawdap6023SbxgGbELnCjJ6GruKQrmvnYvlaZ48XytM/KPSLXUryN5U0bVgpdh81jIB19cV6B8CNN1K1+N3hGWbSr+KL7ZhpJLV1VcxvySRX6MpbRxrhUVR6AUvkpkHaMjvivs63Es61KVL2SV1bc+kq51KpFx5N1YVf51keMm2eE9aYBmxZzHCjJPyHpWzikKg18bCXLJS7HzcXytM/KTwrY6hqWlxSx6VqIG3GGspR0Y/7Na40HU93/ILv/8AwFk/+Jr9QkgSMYVQB6AUvlr6V9z/AK1VF/y6X3n0/wDbk735D8wl0HU2XjSr8n2tJD/7LVa40jU4+ulagOe9nIP/AGWv1H8tfSjy1/uin/rXU/59L7xf25P+Q/LOPRdVuWCR6RqLueipZSsf/QRW/oHwn8a+JLgRaf4W1Iv1LXERhUDIGct9a/Szy1/uilChegqZ8V1pK0aSXzJnndSSsoJHyh8Nf2O5pJo7vxvNC8KMHXT7Vs8jH327jrwK+pdN0+20mygs7OFLe1hQJFDGuFVR0AFWtoo2+9fKYvHV8bLmrSv5Hh18RUxDvUYfSuf8feCdO+InhLUvD+qxebZ3sRjbjlT1DD3BwfwroNtLtrihOVOSnB2aMIycGpLc/Mr4hfBLxd8HdVmi1HT5tR0osfJ1a1RpUdR03hR8jY9a5u2v4J4wfOUDv84z+RwRX6rSW6TKVkVXU8EMM1z138NfCl9cJPP4b0qWdTkSNZxlvzxX3lLiqTglXp3kuqe59TDPG0vaxuz83fDHhnW/G2pfYdA0y41G6DbWaIMI1z6sRgCvqDR/2fx8J/g3451rUf8ATvE9xol0n+jq0giHknCIOSTnHNfTtnpdnpsey0tYbZP7sKBR+QqwVDcHkdK87HcRVsXaEI8sV97OTFZxUr2jFWiflRoui6q1upGjallkU4aylz90Z7eua95/ZD0m9sfi8ZrmwvLVW0+ZQ09u6KTuQ4yR14P5V9ueSi9FA/CjyVzkAA+uK1xnEk8VRnR9klzK248RnEsRCUOS1xc0detO20Yr4w+ePm74/wD7KcPj+8l8QeFZYdM8QSc3EMgxDdYB5IAyH6DOcYzkd6+RfFPhPxH8Pbh7XxNol3pbBtiTSoWgkPP3ZAME8Hj2NfqXtqK4s4bpCk0SSof4XUEV9Zl/EWIwcFSqLniu+/3nuYXNqtCKhNcy/E/KW3uopFX94uOuC/H64pVuPMmEUO6eV22pFEDIzH0AHev02vvhZ4O1KUy3PhjSZpT1kazj3H8cVd0vwP4e0Xb9g0TT7MrypgtkQj8QK9t8VU7XjSd/U9N55C2kH958S/Cz9mXxV4/uFm1a1m8OaKTlpLgbZ5F4yFTtn1PHFfaHgX4faL8OtFi0zRbRLaFQN7YG+RsY3Me5rpcAdKNvOa+RzDNcRmD/AHjtHsjwcVjquKfvaLsZHiwsvhfVtqM5+yS/KoyT8h7V+ZXhvQdYubNZF0PVgpXq1lIOdxz2r9TNtIsar0FbZZm0stjOKhzcxpg8fLBwlGMb8x+fXwN0HVbT41eE5p9Kv4IVumDSS2rqq5icZJI9SK/QUUGMFge9LtrnzLMJZjUVSUbWVjHF4uWLkpSVrISvlz9vGG4u/CnhGC2tLm7dtVLFLWFpGA8lxk7RwOa+pNtMaFXOWG70yOlc+BxTwWIhiEruJnhMQ8LWjWSu0fl7beGtZW3K/wBhapg8BjZyDj/vmvsH9i+1uLX4faulxazWrNqbOEmjZGIMcfOCB6V9BeSvoPypVUIMAYFe1mGezzCi6MoKOtz0sZms8ZTdOUbXdwzWV4i8N6b4w0S70nVrVL2wukMcsMoyCDWtigLivmIylBpp7HhqTi00fCnxW/Y68UeE72S78Hj/AISLReSLWRlW7hHXHICuB0GMH2rw+/tbrRbj7Pq1hd6Xdrx5N9C8bL9MjBH41+re2qd9othqihbyyt7pR0E0SuP1Ffa4XiivSio4iPPbrsz6WhnlWmkqq5rH5d28kckP+uRhj+8TkemKfoPhfV/Fd8LfQ9JvNTkZtq/Z4mZc+7EYUe9fpbH8PfDENx5yeH9MSX+8togP8q17XTLSwTZbW0VuvXbEgUfpXZLiuyfs6er7s65cQJJ8kNX3Z8o/B/8AY2b7RBq3jwRylCHj0iF9yZ7ea38X0GK+sbW1isoY4YY1iijUIkaDAVR0AHapttFfGYzHV8dPnrM+axOLq4qXNVY1unFfmd4usb3U/iZ4ua20nVHjGq3Hz/YZMMCwwQcdK/TPbTPs6KxIUAk5JxXZleZyyyU5RjzcysdOX4+WAc2o35lY/MzT/DeqWviLRp20nUUjS/t2ZntJAABIpyTiv0zj5jUn0oMKnGQOPan4pZlmUsxcHKNuUWOxzxvLeNrCLTqTFLXinlhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRSUAeU/tLaH4w8T/AAuvtM8HRxSXdydtyrPtkaDaxYRn+8SFH0Jr88/7OuNDvDY6lY3Gl3kJw1neRMjr2yAeo9x61+sW2uf8UfD7w541txDrmi2WpoDlTcQhmU4IyD1HU9PWvqcozv8As2EqUoXi+2572X5o8DF03G6f3n5i3EKy7TtVwOjHGf1Gaq+XErYZTn0ZmP8AWvvDX/2N/AGrKfsUd9o7ls5tblnHfgCTcB+HpXMn9hHwwc/8VPrv5w//ABFfW0+I8vkrzun6Hv086wtvev8AcfGqsMEEbewycmpbC3kubhYre3kuLh22rDAhaSQ+gUDr719taH+xL4J0yQteX+raqmPuTTrHznuYwD+FereD/hH4R8B7W0TQrSzmA2/aPL3S44/jOW7DvWeI4pwsY2oRcvwRhWzujZqmrnzz+zn+y9d2+qQeK/GdmsLRnzLHS5MMyHjDye45496+s14XA49Kdt6UYr87xuNq46p7Sq/+AfJ4jEVMTPnmwpaTFLXCcoUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUnNLRQAlLRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAH//2Q=='; // ← paste your full base64 string

// Then inside the HTML header:


function sendWelcomeEmail(transporter, to, name, method, lang = 'de', verifyUrl = null) {
  const CONTENT = {
    de: {
      store_name: "Dein Englisch Buecher",
      greeting: "Hallo {name},",
      regards: "Viele Grüße",
      team: "Dein Englisch Buecher Team",
      welcome: {
        title_google: "Willkommen bei Dein Englisch Buecher!",
        title_manual: "Fast geschafft – bestätige deine E-Mail",
        body_google: "Dein Konto wurde erfolgreich mit Google erstellt. Tauche jetzt ein in die Welt englischer Bücher!",
        body_manual: "Vielen Dank für deine Registrierung! Klicke unten, um deine E-Mail zu bestätigen und loszulegen.",
        button_google: "Jetzt stöbern",
        button_manual: "E-Mail bestätigen",
        info_login: "Login",
        info_method: "Methode",
        method_google: "Google",
        method_manual: "Manuell",
        footer: "© {year} Dein Englisch Buecher. Alle Rechte vorbehalten.",
      },
    },
    en: {
      store_name: "Your Englisch Buecher",
      greeting: "Hello {name},",
      regards: "Best regards",
      team: "Your Englisch Buecher Team",
      welcome: {
        title_google: "Welcome to Your Englisch Buecher!",
        title_manual: "Almost there – verify your email",
        body_google: "Your account was successfully created with Google. Start exploring English books now!",
        body_manual: "Thanks for signing up! Click below to verify your email and get started.",
        button_google: "Start Browsing",
        button_manual: "Verify Email",
        info_login: "Login",
        info_method: "Method",
        method_google: "Google",
        method_manual: "Manual",
        footer: "© {year} Your Englisch Buecher. All rights reserved.",
      },
    },
  };

  const t = CONTENT[lang]?.welcome || CONTENT.de.welcome;
  const store_name = CONTENT[lang]?.store_name || "Dein Buchladen";
  const isGoogle = method === 'google';

  const subject = isGoogle ? t.title_google : t.title_manual;
  const buttonText = isGoogle ? t.button_google : t.button_manual;
  const buttonLink = isGoogle ? `${config.FRONTEND_URL}/` : (verifyUrl || `${config.FRONTEND_URL}/login`);

  const greeting = CONTENT[lang].greeting.replace('{name}', name);
  const regards = CONTENT[lang].regards;
  const team = CONTENT[lang].team;
  //const logoUrl = `../public/assets/logo.png`;
  //const logoUrl = `${process.env.FRONTEND_URL}/assets/logo.png`;
  const logoUrl = `${config.FRONTEND_URL}/assets/logo.png`;

  const rawHtml = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fc; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #5e42d6 0%, #7c3aed 100%); padding: 40px 20px; text-align: center; }
    .header img { height: 56px; filter: brightness(0) invert(1); }
    .content { padding: 40px 32px; text-align: center; }
    h1 { font-size: 28px; margin: 20px 0 16px; color: #1a1a1a; }
    .greeting { font-size: 18px; color: #333; margin-bottom: 16px; text-align: left; }
    p { font-size: 16px; color: #555; margin-bottom: 24px; text-align: left; }
    .info-box { background: #f0f4ff; border-left: 4px solid #7c3aed; padding: 16px 20px; margin: 24px 0; text-align: left; border-radius: 0 8px 8px 0; font-size: 14px; }
    .info-box strong { color: #1a1a1a; }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed, #5e42d6);
      color: white !important;
      font-weight: 600;
      font-size: 16px;
      padding: 14px 36px;
      text-decoration: none;
      border-radius: 50px;
      box-shadow: 0 6px 16px rgba(124, 58, 237, 0.3);
      margin: 20px auto;
      transition: all 0.3s ease;
    }
    .button:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(124, 58, 237, 0.4); }
    .regards { text-align: left; margin-top: 32px; font-size: 16px; color: #333; }
    .team { font-weight: 600; color: #7c3aed; margin-top: 8px; }
    .footer { background: #f1f3f9; padding: 24px; text-align: center; font-size: 12px; color: #777; }
    .footer a { color: #7c3aed; text-decoration: none; }
    @media (max-width: 480px) {
      .container { margin: 15px; border-radius: 12px; }
      .header { padding: 30px 15px; }
      .content { padding: 30px 20px; }
      h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
<div class="header">
  <div style="margin-bottom: 16px;">
    <img src="http://localhost:3000/assets/logo.png" alt="${t.store_name}" style="height: 56px; display: block; margin: 0 auto;" />
  </div>
  <h1 style="color: white; font-size: 32px; font-weight: 700; margin: 0; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">
    ${t.store_name}
  </h1>
</div>
    <div class="content">
      <h1>${isGoogle ? t.title_google : t.title_manual}</h1>
      <p class="greeting">${greeting}</p>
      <p>${isGoogle ? t.body_google : t.body_manual}</p>
      ${!isGoogle ? `
      <div class="info-box">
        <strong>${t.info_login}:</strong> ${to}<br>
        <strong>${t.info_method}:</strong> ${t.method_manual}
      </div>
      ` : ''}
      <div style="text-align: center;">
        <a href="${buttonLink}" class="button">${buttonText}</a>
      </div>
      ${!isGoogle ? `<p style="font-size: 14px; color: #888; margin-top: 16px;">
        ${lang === 'de' ? 'Der Link verfällt in 1 Stunde.' : 'The link expires in 1 hour.'}
      </p>` : ''}
      <div class="regards">
        ${regards},<br>
        <div class="team">${team}</div>
      </div>
    </div>
    <div class="footer">
      ${t.footer.replace('{year}', new Date().getFullYear())}<br>
      <a href="${config.FRONTEND_URL}">${config.FRONTEND_URL}</a>
    </div>
  </div>
</body>
</html>
  `;

  const inlinedHtml = juice(rawHtml);

  return transporter.sendMail({
    from: `"${store_name}" <${process.env.SMTP_USER || process.env.EMAIL_USER}>`,
    to,
    subject,
    html: inlinedHtml,
  }).catch(err => {
    console.error('Welcome email failed:', err);
    throw err;
  });
}

function sendPasswordResetEmail(transporter, to, name, resetUrl, lang = 'de') {
  const CONTENT = {
    de: {
      store_name: "Dein Englisch Buecher",
      subject: "Passwort zurücksetzen",
      title: "Passwort zurücksetzen",
      greeting: `Hallo ${name},`,
      body: "Du hast angefordert, dein Passwort zurückzusetzen. Klicke unten, um ein neues Passwort zu setzen.",
      button: "Neues Passwort setzen",
      info: "Dieser Link verfällt in 15 Minuten.",
      footer: "Falls du das nicht warst – ignoriere diese E-Mail einfach.",
    },
    en: {
      store_name: "Your Englisch Buecher",
      subject: "Reset Your Password",
      title: "Reset Your Password",
      greeting: `Hello ${name},`,
      body: "You requested a password reset. Click below to set a new password.",
      button: "Set New Password",
      info: "This link expires in 15 minutes.",
      footer: "If this wasn't you – just ignore this email.",
    }
  };

  const t = CONTENT[lang] || CONTENT.de;
  const logoUrl = `${config.FRONTEND_URL}/assets/logo.png`;

  const rawHtml = `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${t.subject}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8f9fc; color: #333; line-height: 1.6; }
    .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #5e42d6 0%, #7c3aed 100%); padding: 40px 20px; text-align: center; }
    .header img { height: 56px; filter: brightness(0) invert(1); }
    .content { padding: 40px 32px; text-align: center; }
    h1 { font-size: 28px; margin: 20px 0 16px; color: #1a1a1a; }
    .greeting { font-size: 18px; color: #333; margin-bottom: 16px; text-align: left; }
    p { font-size: 16px; color: #555; margin-bottom: 24px; text-align: left; }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #7c3aed, #5e42d6);
      color: white !important;
      font-weight: 600;
      font-size: 16px;
      padding: 14px 36px;
      text-decoration: none;
      border-radius: 50px;
      box-shadow: 0 6px 16px rgba(124, 58, 237, 0.3);
      margin: 20px auto;
      transition: all 0.3s ease;
    }
    .button:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(124, 58, 237, 0.4); }
    .info { font-size: 14px; color: #888; margin-top: 20px; }
    .footer { background: #f1f3f9; padding: 24px; text-align: center; font-size: 12px; color: #777; }
    @media (max-width: 480px) {
      .container { margin: 15px; border-radius: 12px; }
      .header { padding: 30px 15px; }
      .content { padding: 30px 20px; }
      h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <div class="container">
<div class="header">
  <div style="margin-bottom: 16px;">
    <img src="http://localhost:3000/assets/logo.png" alt="${t.store_name}" style="height: 56px; display: block; margin: 0 auto;" />
  </div>
  <h1 style="color: white; font-size: 32px; font-weight: 700; margin: 0; text-shadow: 0 2px 8px rgba(0,0,0,0.3);">
    ${t.store_name}
  </h1>
</div>
    <div class="content">
      <h1>${t.title}</h1>
      <p class="greeting">${t.greeting}</p>
      <p>${t.body}</p>
      <div style="text-align: center;">
        <a href="${resetUrl}" class="button">${t.button}</a>
      </div>
      <p class="info">${t.info}</p>
      <p style="margin-top: 32px; color: #888;">${t.footer}</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} ${t.store_name}. Alle Rechte vorbehalten.<br>
      <a href="${config.FRONTEND_URL}">${config.FRONTEND_URL}</a>
    </div>
  </div>
</body>
</html>
  `;

  const inlinedHtml = juice(rawHtml);

  return transporter.sendMail({
    from: `"${t.store_name}" <${process.env.SMTP_USER}>`,
    to,
    subject: t.subject,
    html: inlinedHtml,
  }).catch(err => {
    //console.error('Password reset email failed:', err);
    //throw err;
    console.error('PASSWORD RESET EMAIL FAILED (but route continues):', err.message);
  });
}

// EXPORT BOTH
module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail   // ← NEW
};
