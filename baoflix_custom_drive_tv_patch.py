#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BảoFlix Custom Drive TV Patcher

Chạy trong thư mục gốc repo:
    python baoflix_custom_drive_tv_patch.py

Script chỉ sửa file trên máy, KHÔNG commit/push GitHub.
"""

from __future__ import annotations

import argparse
import base64
import os
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def decode_text(value: str) -> str:
    return base64.b64decode(value.encode("ascii")).decode("utf-8")


COMPONENT_CONTENT = decode_text("InVzZSBjbGllbnQiOwoKaW1wb3J0IExpbmsgZnJvbSAibmV4dC9saW5rIjsKaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VNZW1vLCB1c2VSZWYsIHVzZVN0YXRlIH0gZnJvbSAicmVhY3QiOwppbXBvcnQgeyBpc1R2TW9kZUFjdGl2ZSB9IGZyb20gIkAvbGliL3R2TW9kZSI7Cgp0eXBlIEN1c3RvbURyaXZlUGxheWVyUHJvcHMgPSB7CiAgc3JjOiBzdHJpbmc7CiAgdGl0bGU6IHN0cmluZzsKICBzdG9yYWdlS2V5OiBzdHJpbmc7CiAgcHJldmlvdXNIcmVmPzogc3RyaW5nOwogIG5leHRIcmVmPzogc3RyaW5nOwogIGRldGFpbEhyZWY6IHN0cmluZzsKICBvbk9wZW5FcGlzb2RlczogKCkgPT4gdm9pZDsKfTsKCnR5cGUgU3RvcmVkRHJpdmVFc3RpbWF0ZSA9IHsKICBzZWNvbmRzOiBudW1iZXI7CiAgdXBkYXRlZEF0OiBzdHJpbmc7Cn07Cgpjb25zdCBBVVRPX0VOVEVSX0RFTEFZX01TID0gMTgwMDsKY29uc3QgU0FWRV9JTlRFUlZBTF9TRUNPTkRTID0gNTsKCmZ1bmN0aW9uIGZvcm1hdFRpbWUodG90YWxTZWNvbmRzOiBudW1iZXIpIHsKICBjb25zdCBzYWZlID0gTWF0aC5tYXgoMCwgTWF0aC5mbG9vcih0b3RhbFNlY29uZHMpKTsKICBjb25zdCBob3VycyA9IE1hdGguZmxvb3Ioc2FmZSAvIDM2MDApOwogIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKChzYWZlICUgMzYwMCkgLyA2MCk7CiAgY29uc3Qgc2Vjb25kcyA9IHNhZmUgJSA2MDsKCiAgaWYgKGhvdXJzID4gMCkgewogICAgcmV0dXJuIGAke2hvdXJzfToke1N0cmluZyhtaW51dGVzKS5wYWRTdGFydCgyLCAiMCIpfToke1N0cmluZyhzZWNvbmRzKS5wYWRTdGFydCgyLCAiMCIpfWA7CiAgfQoKICByZXR1cm4gYCR7bWludXRlc306JHtTdHJpbmcoc2Vjb25kcykucGFkU3RhcnQoMiwgIjAiKX1gOwp9CgpmdW5jdGlvbiByZWFkRXN0aW1hdGUoc3RvcmFnZUtleTogc3RyaW5nKSB7CiAgdHJ5IHsKICAgIGNvbnN0IHJhdyA9IGxvY2FsU3RvcmFnZS5nZXRJdGVtKHN0b3JhZ2VLZXkpOwogICAgaWYgKCFyYXcpIHJldHVybiAwOwoKICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UocmF3KSBhcyBQYXJ0aWFsPFN0b3JlZERyaXZlRXN0aW1hdGU+OwogICAgY29uc3Qgc2Vjb25kcyA9IE51bWJlcihwYXJzZWQuc2Vjb25kcyB8fCAwKTsKCiAgICByZXR1cm4gTnVtYmVyLmlzRmluaXRlKHNlY29uZHMpICYmIHNlY29uZHMgPiAwID8gTWF0aC5mbG9vcihzZWNvbmRzKSA6IDA7CiAgfSBjYXRjaCB7CiAgICByZXR1cm4gMDsKICB9Cn0KCmZ1bmN0aW9uIHNhdmVFc3RpbWF0ZShzdG9yYWdlS2V5OiBzdHJpbmcsIHNlY29uZHM6IG51bWJlcikgewogIHRyeSB7CiAgICBjb25zdCBwYXlsb2FkOiBTdG9yZWREcml2ZUVzdGltYXRlID0gewogICAgICBzZWNvbmRzOiBNYXRoLm1heCgwLCBNYXRoLmZsb29yKHNlY29uZHMpKSwKICAgICAgdXBkYXRlZEF0OiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksCiAgICB9OwoKICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKHN0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KHBheWxvYWQpKTsKICB9IGNhdGNoIHsKICAgIC8vIELhu48gcXVhIG7hur91IFdlYlZpZXcgY2jhurduIGxvY2FsU3RvcmFnZS4KICB9Cn0KCmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEN1c3RvbURyaXZlUGxheWVyKHsKICBzcmMsCiAgdGl0bGUsCiAgc3RvcmFnZUtleSwKICBwcmV2aW91c0hyZWYsCiAgbmV4dEhyZWYsCiAgZGV0YWlsSHJlZiwKICBvbk9wZW5FcGlzb2RlcywKfTogQ3VzdG9tRHJpdmVQbGF5ZXJQcm9wcykgewogIGNvbnN0IGlmcmFtZVJlZiA9IHVzZVJlZjxIVE1MSUZyYW1lRWxlbWVudCB8IG51bGw+KG51bGwpOwogIGNvbnN0IHNlY29uZHNSZWYgPSB1c2VSZWYoMCk7CiAgY29uc3Qgc2F2ZVRpY2tSZWYgPSB1c2VSZWYoMCk7CiAgY29uc3QgYXV0b0VudGVyVGltZXJSZWYgPSB1c2VSZWY8bnVtYmVyIHwgbnVsbD4obnVsbCk7CgogIGNvbnN0IFt0dk1vZGUsIHNldFR2TW9kZV0gPSB1c2VTdGF0ZShmYWxzZSk7CiAgY29uc3QgW3RyYWNraW5nLCBzZXRUcmFja2luZ10gPSB1c2VTdGF0ZShmYWxzZSk7CiAgY29uc3QgW292ZXJsYXlWaXNpYmxlLCBzZXRPdmVybGF5VmlzaWJsZV0gPSB1c2VTdGF0ZSh0cnVlKTsKICBjb25zdCBbc2Vjb25kcywgc2V0U2Vjb25kc10gPSB1c2VTdGF0ZSgwKTsKCiAgY29uc3Qgb2xkTWFya2VyTGFiZWwgPSB1c2VNZW1vKCgpID0+IHsKICAgIHJldHVybiBzZWNvbmRzID4gMCA/IGZvcm1hdFRpbWUoc2Vjb25kcykgOiAiY2jGsGEgY8OzIjsKICB9LCBbc2Vjb25kc10pOwoKICB1c2VFZmZlY3QoKCkgPT4gewogICAgZnVuY3Rpb24gcmVmcmVzaFR2TW9kZSgpIHsKICAgICAgc2V0VHZNb2RlKGlzVHZNb2RlQWN0aXZlKHsgYWxsb3dTZXNzaW9uT25EZXNrdG9wOiBmYWxzZSB9KSk7CiAgICB9CgogICAgcmVmcmVzaFR2TW9kZSgpOwoKICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCJiYW9mbGl4LXR2LW1vZGUtY2hhbmdlIiwgcmVmcmVzaFR2TW9kZSk7CiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigic3RvcmFnZSIsIHJlZnJlc2hUdk1vZGUpOwogICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoImZvY3VzIiwgcmVmcmVzaFR2TW9kZSk7CgogICAgcmV0dXJuICgpID0+IHsKICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoImJhb2ZsaXgtdHYtbW9kZS1jaGFuZ2UiLCByZWZyZXNoVHZNb2RlKTsKICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoInN0b3JhZ2UiLCByZWZyZXNoVHZNb2RlKTsKICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoImZvY3VzIiwgcmVmcmVzaFR2TW9kZSk7CiAgICB9OwogIH0sIFtdKTsKCiAgdXNlRWZmZWN0KCgpID0+IHsKICAgIGNvbnN0IHNhdmVkID0gcmVhZEVzdGltYXRlKHN0b3JhZ2VLZXkpOwogICAgc2Vjb25kc1JlZi5jdXJyZW50ID0gc2F2ZWQ7CiAgICBzZXRTZWNvbmRzKHNhdmVkKTsKICAgIHNhdmVUaWNrUmVmLmN1cnJlbnQgPSBzYXZlZDsKICB9LCBbc3RvcmFnZUtleV0pOwoKICB1c2VFZmZlY3QoKCkgPT4gewogICAgaWYgKCF0dk1vZGUpIHsKICAgICAgc2V0VHJhY2tpbmcoZmFsc2UpOwogICAgICBzZXRPdmVybGF5VmlzaWJsZShmYWxzZSk7CiAgICAgIHJldHVybjsKICAgIH0KCiAgICBzZXRPdmVybGF5VmlzaWJsZSh0cnVlKTsKCiAgICBhdXRvRW50ZXJUaW1lclJlZi5jdXJyZW50ID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4gewogICAgICBhdXRvRW50ZXJUaW1lclJlZi5jdXJyZW50ID0gbnVsbDsKICAgICAgc2V0VHJhY2tpbmcodHJ1ZSk7CiAgICAgIHNldE92ZXJsYXlWaXNpYmxlKGZhbHNlKTsKCiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHsKICAgICAgICBpZnJhbWVSZWYuY3VycmVudD8uZm9jdXMoeyBwcmV2ZW50U2Nyb2xsOiB0cnVlIH0pOwogICAgICB9LCA4MCk7CiAgICB9LCBBVVRPX0VOVEVSX0RFTEFZX01TKTsKCiAgICByZXR1cm4gKCkgPT4gewogICAgICBpZiAoYXV0b0VudGVyVGltZXJSZWYuY3VycmVudCAhPT0gbnVsbCkgewogICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoYXV0b0VudGVyVGltZXJSZWYuY3VycmVudCk7CiAgICAgICAgYXV0b0VudGVyVGltZXJSZWYuY3VycmVudCA9IG51bGw7CiAgICAgIH0KICAgIH07CiAgfSwgW3NyYywgdHZNb2RlXSk7CgogIHVzZUVmZmVjdCgoKSA9PiB7CiAgICBpZiAoIXRyYWNraW5nKSByZXR1cm47CgogICAgY29uc3QgdGltZXIgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4gewogICAgICBpZiAoZG9jdW1lbnQudmlzaWJpbGl0eVN0YXRlICE9PSAidmlzaWJsZSIpIHJldHVybjsKCiAgICAgIHNlY29uZHNSZWYuY3VycmVudCArPSAxOwogICAgICBjb25zdCBuZXh0ID0gc2Vjb25kc1JlZi5jdXJyZW50OwogICAgICBzZXRTZWNvbmRzKG5leHQpOwoKICAgICAgaWYgKG5leHQgLSBzYXZlVGlja1JlZi5jdXJyZW50ID49IFNBVkVfSU5URVJWQUxfU0VDT05EUykgewogICAgICAgIHNhdmVUaWNrUmVmLmN1cnJlbnQgPSBuZXh0OwogICAgICAgIHNhdmVFc3RpbWF0ZShzdG9yYWdlS2V5LCBuZXh0KTsKICAgICAgfQogICAgfSwgMTAwMCk7CgogICAgcmV0dXJuICgpID0+IHdpbmRvdy5jbGVhckludGVydmFsKHRpbWVyKTsKICB9LCBbc3RvcmFnZUtleSwgdHJhY2tpbmddKTsKCiAgdXNlRWZmZWN0KCgpID0+IHsKICAgIGZ1bmN0aW9uIGZsdXNoRXN0aW1hdGUoKSB7CiAgICAgIHNhdmVFc3RpbWF0ZShzdG9yYWdlS2V5LCBzZWNvbmRzUmVmLmN1cnJlbnQpOwogICAgfQoKICAgIGZ1bmN0aW9uIGhhbmRsZVZpc2liaWxpdHlDaGFuZ2UoKSB7CiAgICAgIGlmIChkb2N1bWVudC52aXNpYmlsaXR5U3RhdGUgPT09ICJoaWRkZW4iKSB7CiAgICAgICAgZmx1c2hFc3RpbWF0ZSgpOwogICAgICB9CiAgICB9CgogICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoInBhZ2VoaWRlIiwgZmx1c2hFc3RpbWF0ZSk7CiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigiYmVmb3JldW5sb2FkIiwgZmx1c2hFc3RpbWF0ZSk7CiAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCJ2aXNpYmlsaXR5Y2hhbmdlIiwgaGFuZGxlVmlzaWJpbGl0eUNoYW5nZSk7CgogICAgcmV0dXJuICgpID0+IHsKICAgICAgZmx1c2hFc3RpbWF0ZSgpOwogICAgICB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcigicGFnZWhpZGUiLCBmbHVzaEVzdGltYXRlKTsKICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoImJlZm9yZXVubG9hZCIsIGZsdXNoRXN0aW1hdGUpOwogICAgICBkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCJ2aXNpYmlsaXR5Y2hhbmdlIiwgaGFuZGxlVmlzaWJpbGl0eUNoYW5nZSk7CiAgICB9OwogIH0sIFtzdG9yYWdlS2V5XSk7CgogIGZ1bmN0aW9uIGNsZWFyQXV0b0VudGVyVGltZXIoKSB7CiAgICBpZiAoYXV0b0VudGVyVGltZXJSZWYuY3VycmVudCAhPT0gbnVsbCkgewogICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KGF1dG9FbnRlclRpbWVyUmVmLmN1cnJlbnQpOwogICAgICBhdXRvRW50ZXJUaW1lclJlZi5jdXJyZW50ID0gbnVsbDsKICAgIH0KICB9CgogIGZ1bmN0aW9uIGVudGVyRHJpdmVQbGF5ZXIoKSB7CiAgICBjbGVhckF1dG9FbnRlclRpbWVyKCk7CiAgICBzZXRUcmFja2luZyh0cnVlKTsKICAgIHNldE92ZXJsYXlWaXNpYmxlKGZhbHNlKTsKCiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7CiAgICAgIGlmcmFtZVJlZi5jdXJyZW50Py5mb2N1cyh7IHByZXZlbnRTY3JvbGw6IHRydWUgfSk7CiAgICB9LCA1MCk7CiAgfQoKICBmdW5jdGlvbiBvcGVuRXBpc29kZXMoKSB7CiAgICBjbGVhckF1dG9FbnRlclRpbWVyKCk7CiAgICBzZXRUcmFja2luZyhmYWxzZSk7CiAgICBvbk9wZW5FcGlzb2RlcygpOwogIH0KCiAgZnVuY3Rpb24gcmVzZXRFc3RpbWF0ZSgpIHsKICAgIHNlY29uZHNSZWYuY3VycmVudCA9IDA7CiAgICBzYXZlVGlja1JlZi5jdXJyZW50ID0gMDsKICAgIHNldFNlY29uZHMoMCk7CiAgICBzYXZlRXN0aW1hdGUoc3RvcmFnZUtleSwgMCk7CiAgfQoKICByZXR1cm4gKAogICAgPGRpdiBjbGFzc05hbWU9InJlbGF0aXZlIGgtZnVsbCB3LWZ1bGwgb3ZlcmZsb3ctaGlkZGVuIGJnLWJsYWNrIj4KICAgICAgPGlmcmFtZQogICAgICAgIHJlZj17aWZyYW1lUmVmfQogICAgICAgIHNyYz17c3JjfQogICAgICAgIGFsbG93RnVsbFNjcmVlbgogICAgICAgIGFsbG93PSJhdXRvcGxheTsgZW5jcnlwdGVkLW1lZGlhOyBwaWN0dXJlLWluLXBpY3R1cmU7IGZ1bGxzY3JlZW4iCiAgICAgICAgdGFiSW5kZXg9ezB9CiAgICAgICAgZGF0YS10di1wbGF5ZXI9ImRyaXZlLWlmcmFtZSIKICAgICAgICBjbGFzc05hbWU9ImgtZnVsbCB3LWZ1bGwgYm9yZGVyLTAgYmctYmxhY2sgb3V0bGluZS1ub25lIgogICAgICAgIHRpdGxlPXt0aXRsZX0KICAgICAgLz4KCiAgICAgIHt0dk1vZGUgJiYgIW92ZXJsYXlWaXNpYmxlICYmICgKICAgICAgICA8ZGl2IGNsYXNzTmFtZT0icG9pbnRlci1ldmVudHMtbm9uZSBhYnNvbHV0ZSByaWdodC00IHRvcC00IHJvdW5kZWQteGwgYm9yZGVyIGJvcmRlci13aGl0ZS8xMCBiZy1ibGFjay82NSBweC0zIHB5LTIgdGV4dC1yaWdodCBzaGFkb3cteGwgYmFja2Ryb3AtYmx1ciI+CiAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQtWzEwcHhdIGZvbnQtYmxhY2sgdXBwZXJjYXNlIHRyYWNraW5nLVswLjE0ZW1dIHRleHQteWVsbG93LTMwMCI+CiAgICAgICAgICAgIE3hu5FjIHhlbSDGsOG7m2MgdMOtbmgKICAgICAgICAgIDwvcD4KICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMC41IHRleHQtc20gZm9udC1ibGFjayB0ZXh0LXdoaXRlIj57Zm9ybWF0VGltZShzZWNvbmRzKX08L3A+CiAgICAgICAgPC9kaXY+CiAgICAgICl9CgogICAgICB7dHZNb2RlICYmIG92ZXJsYXlWaXNpYmxlICYmICgKICAgICAgICA8ZGl2IGNsYXNzTmFtZT0iYWJzb2x1dGUgaW5zZXQtMCB6LTIwIGZsZXggaXRlbXMtZW5kIGJnLWdyYWRpZW50LXRvLXQgZnJvbS1ibGFjayB2aWEtYmxhY2svNjAgdG8tYmxhY2svMjAgcC1bNHZ3XSI+CiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT0idy1mdWxsIHJvdW5kZWQtM3hsIGJvcmRlciBib3JkZXItd2hpdGUvMTAgYmctWyMwODBjMTRdLzk1IHAtNSBzaGFkb3ctMnhsIGJhY2tkcm9wLWJsdXIteGwiPgogICAgICAgICAgICA8cCBjbGFzc05hbWU9InRleHQteHMgZm9udC1ibGFjayB1cHBlcmNhc2UgdHJhY2tpbmctWzAuMmVtXSB0ZXh0LXllbGxvdy0zMDAiPgogICAgICAgICAgICAgIEdvb2dsZSBEcml2ZSB0csOqbiBUVgogICAgICAgICAgICA8L3A+CgogICAgICAgICAgICA8aDIgY2xhc3NOYW1lPSJtdC0yIGxpbmUtY2xhbXAtMSB0ZXh0LXhsIGZvbnQtYmxhY2sgdGV4dC13aGl0ZSI+CiAgICAgICAgICAgICAge3RpdGxlfQogICAgICAgICAgICA8L2gyPgoKICAgICAgICAgICAgPHAgY2xhc3NOYW1lPSJtdC0yIHRleHQtc20gbGVhZGluZy02IHRleHQtc2xhdGUtMzAwIj4KICAgICAgICAgICAgICDEkGFuZyBwaMOzbmcga8OtbiBtw6BuIGjDrG5oLiBC4bqjb0ZsaXggc+G6vSB04buxIGNodXnhu4NuIGZvY3VzIHbDoG8gRHJpdmUgc2F1CiAgICAgICAgICAgICAgZ2nDonkgbMOhdC4gTuG6v3UgdmlkZW8gY2jGsGEgdOG7sSBjaOG6oXksIGLhuqVtIE9LIG3hu5l0IGzhuqduLgogICAgICAgICAgICA8L3A+CgogICAgICAgICAgICA8cCBjbGFzc05hbWU9Im10LTIgdGV4dC1zbSBmb250LWJvbGQgdGV4dC15ZWxsb3ctMTAwIj4KICAgICAgICAgICAgICBM4bqnbiB0csaw4bubYyBi4bqhbiBt4bufIHThu5tpIGtob+G6o25nOiB7b2xkTWFya2VyTGFiZWx9CiAgICAgICAgICAgIDwvcD4KCiAgICAgICAgICAgIDxwIGNsYXNzTmFtZT0ibXQtMSB0ZXh0LXhzIHRleHQtc2xhdGUtNDAwIj4KICAgICAgICAgICAgICDEkMOieSBsw6AgdGjhu51pIGdpYW4gxrDhu5tjIHTDrW5oIGtoaSB0cmFuZyDEkWFuZyBt4bufOyBEcml2ZSBraMO0bmcgY2hvIGFwcAogICAgICAgICAgICAgIMSR4buNYyB0aOG7nWkgxJFp4buDbSBwaMOhdCB0aOG6rXQgYsOqbiB0cm9uZyBpZnJhbWUuCiAgICAgICAgICAgIDwvcD4KCiAgICAgICAgICAgIDxkaXYKICAgICAgICAgICAgICBkYXRhLXR2LXJvdwogICAgICAgICAgICAgIGRhdGEtdHYtcm93LXdyYXA9InRydWUiCiAgICAgICAgICAgICAgY2xhc3NOYW1lPSJtdC01IGdyaWQgZ3JpZC1jb2xzLTIgZ2FwLTIgbWQ6Z3JpZC1jb2xzLTYiCiAgICAgICAgICAgID4KICAgICAgICAgICAgICA8YnV0dG9uCiAgICAgICAgICAgICAgICB0eXBlPSJidXR0b24iCiAgICAgICAgICAgICAgICBkYXRhLXR2LWRlZmF1bHQKICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2VudGVyRHJpdmVQbGF5ZXJ9CiAgICAgICAgICAgICAgICBjbGFzc05hbWU9InJvdW5kZWQtMnhsIGJnLXllbGxvdy0zMDAgcHgtNCBweS0zIHRleHQtc20gZm9udC1ibGFjayB0ZXh0LWJsYWNrIGhvdmVyOmJnLXllbGxvdy0yMDAiCiAgICAgICAgICAgICAgPgogICAgICAgICAgICAgICAg4pa2IFbDoG8gdHLDrG5oIHBow6F0CiAgICAgICAgICAgICAgPC9idXR0b24+CgogICAgICAgICAgICAgIDxidXR0b24KICAgICAgICAgICAgICAgIHR5cGU9ImJ1dHRvbiIKICAgICAgICAgICAgICAgIG9uQ2xpY2s9e29wZW5FcGlzb2Rlc30KICAgICAgICAgICAgICAgIGNsYXNzTmFtZT0icm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci13aGl0ZS8xMCBiZy13aGl0ZS8xMCBweC00IHB5LTMgdGV4dC1zbSBmb250LWJsYWNrIHRleHQtd2hpdGUgaG92ZXI6Ymctd2hpdGUvMTUiCiAgICAgICAgICAgICAgPgogICAgICAgICAgICAgICAgVOG6rXAKICAgICAgICAgICAgICA8L2J1dHRvbj4KCiAgICAgICAgICAgICAge3ByZXZpb3VzSHJlZiA/ICgKICAgICAgICAgICAgICAgIDxMaW5rCiAgICAgICAgICAgICAgICAgIGhyZWY9e3ByZXZpb3VzSHJlZn0KICAgICAgICAgICAgICAgICAgb25DbGljaz17Y2xlYXJBdXRvRW50ZXJUaW1lcn0KICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPSJyb3VuZGVkLTJ4bCBib3JkZXIgYm9yZGVyLXdoaXRlLzEwIGJnLXdoaXRlLzEwIHB4LTQgcHktMyB0ZXh0LWNlbnRlciB0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC13aGl0ZSBob3ZlcjpiZy13aGl0ZS8xNSIKICAgICAgICAgICAgICAgID4KICAgICAgICAgICAgICAgICAg4oaQIFThuq1wIHRyxrDhu5tjCiAgICAgICAgICAgICAgICA8L0xpbms+CiAgICAgICAgICAgICAgKSA6ICgKICAgICAgICAgICAgICAgIDxidXR0b24KICAgICAgICAgICAgICAgICAgdHlwZT0iYnV0dG9uIgogICAgICAgICAgICAgICAgICBkaXNhYmxlZAogICAgICAgICAgICAgICAgICBjbGFzc05hbWU9InJvdW5kZWQtMnhsIGJvcmRlciBib3JkZXItd2hpdGUvMTAgYmctd2hpdGUvNSBweC00IHB5LTMgdGV4dC1zbSBmb250LWJsYWNrIHRleHQtd2hpdGUgb3BhY2l0eS0zNSIKICAgICAgICAgICAgICAgID4KICAgICAgICAgICAgICAgICAg4oaQIFThuq1wIHRyxrDhu5tjCiAgICAgICAgICAgICAgICA8L2J1dHRvbj4KICAgICAgICAgICAgICApfQoKICAgICAgICAgICAgICB7bmV4dEhyZWYgPyAoCiAgICAgICAgICAgICAgICA8TGluawogICAgICAgICAgICAgICAgICBocmVmPXtuZXh0SHJlZn0KICAgICAgICAgICAgICAgICAgb25DbGljaz17Y2xlYXJBdXRvRW50ZXJUaW1lcn0KICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPSJyb3VuZGVkLTJ4bCBiZy1yZWQtNjAwIHB4LTQgcHktMyB0ZXh0LWNlbnRlciB0ZXh0LXNtIGZvbnQtYmxhY2sgdGV4dC13aGl0ZSBob3ZlcjpiZy1yZWQtNTAwIgogICAgICAgICAgICAgICAgPgogICAgICAgICAgICAgICAgICBU4bqtcCBzYXUg4oaSCiAgICAgICAgICAgICAgICA8L0xpbms+CiAgICAgICAgICAgICAgKSA6ICgKICAgICAgICAgICAgICAgIDxidXR0b24KICAgICAgICAgICAgICAgICAgdHlwZT0iYnV0dG9uIgogICAgICAgICAgICAgICAgICBkaXNhYmxlZAogICAgICAgICAgICAgICAgICBjbGFzc05hbWU9InJvdW5kZWQtMnhsIGJnLXJlZC02MDAgcHgtNCBweS0zIHRleHQtc20gZm9udC1ibGFjayB0ZXh0LXdoaXRlIG9wYWNpdHktMzUiCiAgICAgICAgICAgICAgICA+CiAgICAgICAgICAgICAgICAgIFThuq1wIHNhdSDihpIKICAgICAgICAgICAgICAgIDwvYnV0dG9uPgogICAgICAgICAgICAgICl9CgogICAgICAgICAgICAgIDxMaW5rCiAgICAgICAgICAgICAgICBocmVmPSIvY2FpLWRhdD90dj0xIgogICAgICAgICAgICAgICAgb25DbGljaz17Y2xlYXJBdXRvRW50ZXJUaW1lcn0KICAgICAgICAgICAgICAgIGNsYXNzTmFtZT0icm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci13aGl0ZS8xMCBiZy13aGl0ZS8xMCBweC00IHB5LTMgdGV4dC1jZW50ZXIgdGV4dC1zbSBmb250LWJsYWNrIHRleHQtd2hpdGUgaG92ZXI6Ymctd2hpdGUvMTUiCiAgICAgICAgICAgICAgPgogICAgICAgICAgICAgICAgQ8OgaSDEkeG6t3QKICAgICAgICAgICAgICA8L0xpbms+CgogICAgICAgICAgICAgIDxMaW5rCiAgICAgICAgICAgICAgICBocmVmPXtkZXRhaWxIcmVmfQogICAgICAgICAgICAgICAgb25DbGljaz17Y2xlYXJBdXRvRW50ZXJUaW1lcn0KICAgICAgICAgICAgICAgIGNsYXNzTmFtZT0icm91bmRlZC0yeGwgYm9yZGVyIGJvcmRlci13aGl0ZS8xMCBiZy13aGl0ZS8xMCBweC00IHB5LTMgdGV4dC1jZW50ZXIgdGV4dC1zbSBmb250LWJsYWNrIHRleHQtd2hpdGUgaG92ZXI6Ymctd2hpdGUvMTUiCiAgICAgICAgICAgICAgPgogICAgICAgICAgICAgICAgVGhvw6F0IHBoaW0KICAgICAgICAgICAgICA8L0xpbms+CiAgICAgICAgICAgIDwvZGl2PgoKICAgICAgICAgICAge3NlY29uZHMgPiAwICYmICgKICAgICAgICAgICAgICA8YnV0dG9uCiAgICAgICAgICAgICAgICB0eXBlPSJidXR0b24iCiAgICAgICAgICAgICAgICBvbkNsaWNrPXtyZXNldEVzdGltYXRlfQogICAgICAgICAgICAgICAgY2xhc3NOYW1lPSJtdC0zIHRleHQteHMgZm9udC1ib2xkIHRleHQtc2xhdGUtNDAwIHVuZGVybGluZSB1bmRlcmxpbmUtb2Zmc2V0LTQgaG92ZXI6dGV4dC13aGl0ZSIKICAgICAgICAgICAgICA+CiAgICAgICAgICAgICAgICDEkOG6t3QgbOG6oWkgbeG7kWMgxrDhu5tjIHTDrW5oIHbhu4EgMAogICAgICAgICAgICAgIDwvYnV0dG9uPgogICAgICAgICAgICApfQogICAgICAgICAgPC9kaXY+CiAgICAgICAgPC9kaXY+CiAgICAgICl9CiAgICA8L2Rpdj4KICApOwp9Cg==")
OLD_IFRAME = decode_text("ICAgICAgICAgIHtlcGlzb2RlPy5saW5rX2VtYmVkID8gKAogICAgICAgICAgICA8aWZyYW1lCiAgICAgICAgICAgICAgc3JjPXtlcGlzb2RlLmxpbmtfZW1iZWR9CiAgICAgICAgICAgICAgYWxsb3dGdWxsU2NyZWVuCiAgICAgICAgICAgICAgYWxsb3c9ImF1dG9wbGF5OyBlbmNyeXB0ZWQtbWVkaWE7IHBpY3R1cmUtaW4tcGljdHVyZTsgZnVsbHNjcmVlbiIKICAgICAgICAgICAgICBjbGFzc05hbWU9ImgtZnVsbCB3LWZ1bGwiCiAgICAgICAgICAgICAgdGl0bGU9e2Ake21vdmllLm5hbWV9IC0gJHtlcGlzb2RlLm5hbWV9YH0KICAgICAgICAgICAgLz4KICAgICAgICAgICkgOiBlcGlzb2RlPy5saW5rX20zdTggPyAo")
NEW_IFRAME = decode_text("ICAgICAgICAgIHtlcGlzb2RlPy5saW5rX2VtYmVkID8gKAogICAgICAgICAgICA8Q3VzdG9tRHJpdmVQbGF5ZXIKICAgICAgICAgICAgICBzcmM9e2VwaXNvZGUubGlua19lbWJlZH0KICAgICAgICAgICAgICB0aXRsZT17YCR7bW92aWUubmFtZX0gLSAke2VwaXNvZGUubmFtZX1gfQogICAgICAgICAgICAgIHN0b3JhZ2VLZXk9e2Ake3dhdGNoVGltZUtleX1fZHJpdmVfZXN0aW1hdGVgfQogICAgICAgICAgICAgIHByZXZpb3VzSHJlZj17cHJldmlvdXNIcmVmfQogICAgICAgICAgICAgIG5leHRIcmVmPXtuZXh0SHJlZn0KICAgICAgICAgICAgICBkZXRhaWxIcmVmPXtgL2NhLW5oYW4vJHttb3ZpZS5zbHVnfWB9CiAgICAgICAgICAgICAgb25PcGVuRXBpc29kZXM9eygpID0+IHNldEVwaXNvZGVQYW5lbE9wZW4odHJ1ZSl9CiAgICAgICAgICAgIC8+CiAgICAgICAgICApIDogZXBpc29kZT8ubGlua19tM3U4ID8gKA==")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Tối ưu Google Drive player cho phim riêng trên TV."
    )
    parser.add_argument("--repo", type=Path, help="Đường dẫn repo BảoFlix.")
    parser.add_argument("--skip-build", action="store_true")
    return parser.parse_args()


def find_repo_root(start: Path) -> Path:
    start = start.resolve()

    for candidate in [start, *start.parents]:
        page = candidate / "app" / "ca-nhan" / "[slug]" / "xem" / "page.tsx"

        if (candidate / "package.json").is_file() and page.is_file():
            return candidate

    raise FileNotFoundError(
        "Không tìm thấy repo BảoFlix. Đặt file Python cạnh package.json "
        "hoặc dùng --repo DUONG_DAN."
    )


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        content.replace("\r\n", "\n").rstrip() + "\n",
        encoding="utf-8",
    )


def backup_file(path: Path, repo_root: Path, backup_root: Path) -> None:
    if not path.exists():
        return

    destination = backup_root / path.relative_to(repo_root)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, destination)


def patch_watch_page(text: str) -> str:
    import_line = 'import CustomDrivePlayer from "@/components/CustomDrivePlayer";'

    if import_line not in text:
        anchor = 'import HlsPlayer from "@/components/HlsPlayer";'
        if anchor not in text:
            raise RuntimeError("Không tìm thấy import HlsPlayer.")
        text = text.replace(anchor, anchor + "\n" + import_line, 1)

    tv_import = 'import { isTvModeActive } from "@/lib/tvMode";'

    if tv_import not in text:
        anchor = 'import type { Episode } from "@/lib/kkphim";'
        if anchor not in text:
            raise RuntimeError("Không tìm thấy import Episode.")
        text = text.replace(anchor, anchor + "\n" + tv_import, 1)

    state_anchor = (
        "  const [activeGroupBySeason, setActiveGroupBySeason] = "
        "useState<Record<number, number>>({});"
    )

    if "const [tvDriveMode, setTvDriveMode]" not in text:
        if state_anchor not in text:
            raise RuntimeError("Không tìm thấy cụm state của trang xem phim riêng.")
        text = text.replace(
            state_anchor,
            state_anchor + "\n  const [tvDriveMode, setTvDriveMode] = useState(false);",
            1,
        )

    episode_anchor = "  const episode = episodes[safeIndex];"

    tv_effect = """  useEffect(() => {
    function refreshTvDriveMode() {
      setTvDriveMode(
        Boolean(episode?.link_embed) &&
          isTvModeActive({ allowSessionOnDesktop: false })
      );
    }

    refreshTvDriveMode();

    window.addEventListener("baoflix-tv-mode-change", refreshTvDriveMode);
    window.addEventListener("storage", refreshTvDriveMode);
    window.addEventListener("focus", refreshTvDriveMode);

    return () => {
      window.removeEventListener("baoflix-tv-mode-change", refreshTvDriveMode);
      window.removeEventListener("storage", refreshTvDriveMode);
      window.removeEventListener("focus", refreshTvDriveMode);
    };
  }, [episode?.link_embed]);"""

    if "function refreshTvDriveMode()" not in text:
        if episode_anchor not in text:
            raise RuntimeError("Không tìm thấy biến episode.")
        text = text.replace(
            episode_anchor,
            episode_anchor + "\n\n" + tv_effect,
            1,
        )

    if "<FullscreenPlayerBox>" in text:
        text = text.replace(
            "<FullscreenPlayerBox>",
            "<FullscreenPlayerBox tvImmersive={tvDriveMode}>",
            1,
        )
    elif '<FullscreenPlayerBox tvImmersive={tvDriveMode}>' not in text:
        raise RuntimeError("Không nhận diện được FullscreenPlayerBox.")

    if OLD_IFRAME in text:
        text = text.replace(OLD_IFRAME, NEW_IFRAME, 1)
    elif "<CustomDrivePlayer" not in text:
        raise RuntimeError("Không nhận diện được iframe Google Drive cũ.")

    if "fixed inset-0 z-50 flex items-end" in text:
        text = text.replace(
            "fixed inset-0 z-50 flex items-end",
            "fixed inset-0 z-[140] flex items-end",
            1,
        )

    return text


def validate(component_text: str, page_text: str) -> None:
    required_component = [
        "Mốc xem ước tính",
        "AUTO_ENTER_DELAY_MS",
        "iframeRef.current?.focus",
        "visibilitychange",
        'href="/cai-dat?tv=1"',
    ]
    required_page = [
        'import CustomDrivePlayer from "@/components/CustomDrivePlayer";',
        'import { isTvModeActive } from "@/lib/tvMode";',
        "const [tvDriveMode, setTvDriveMode]",
        "<FullscreenPlayerBox tvImmersive={tvDriveMode}>",
        "<CustomDrivePlayer",
        "z-[140]",
    ]

    missing = (
        [item for item in required_component if item not in component_text]
        + [item for item in required_page if item not in page_text]
    )

    if missing:
        raise RuntimeError("Patch thiếu marker:\n- " + "\n- ".join(missing))


def run_build(repo_root: Path) -> None:
    npm = "npm.cmd" if os.name == "nt" else "npm"
    command = [npm, "run", "build"]

    print("\n> " + " ".join(command))
    result = subprocess.run(command, cwd=repo_root)

    if result.returncode != 0:
        raise RuntimeError(f"Build thất bại với mã {result.returncode}.")


def main() -> int:
    args = parse_args()

    try:
        repo_root = find_repo_root(args.repo or Path.cwd())
    except Exception as error:
        print(f"LỖI: {error}", file=sys.stderr)
        return 1

    page_path = repo_root / "app" / "ca-nhan" / "[slug]" / "xem" / "page.tsx"
    component_path = repo_root / "components" / "CustomDrivePlayer.tsx"

    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_root = repo_root / "backup" / f"custom-drive-tv-{timestamp}"
    backup_root.mkdir(parents=True, exist_ok=True)

    try:
        backup_file(page_path, repo_root, backup_root)
        backup_file(component_path, repo_root, backup_root)

        write_text(component_path, COMPONENT_CONTENT)
        print("✓ Đã tạo components/CustomDrivePlayer.tsx")

        patched_page = patch_watch_page(read_text(page_path))
        write_text(page_path, patched_page)
        print("✓ Đã tối ưu trang xem phim riêng cho TV")

        validate(read_text(component_path), read_text(page_path))
        print(f"✓ Backup: {backup_root}")

        if not args.skip_build:
            run_build(repo_root)
            print("✓ Build thành công")
        else:
            print("! Đã bỏ qua build")

        print(
            "\nHOÀN TẤT.\n"
            "1. npm run dev\n"
            "2. Mở phim riêng bằng TV Mode.\n"
            "3. Player phải kín màn hình ngay.\n"
            "4. Sau khoảng 1,8 giây app tự focus Drive; nếu chưa phát hãy bấm OK.\n"
            "5. Xem vài phút rồi thoát, mở lại cùng tập để thấy mốc ước tính.\n\n"
            "Mốc này là thời gian trang mở, không phải currentTime thật của Drive.\n"
            "Script không commit hoặc push GitHub."
        )
        return 0

    except Exception as error:
        print(f"\nLỖI: {error}", file=sys.stderr)
        print(f"Backup: {backup_root}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
