%define lo8_rax al
%define lo8_rbx bl
%define lo8_rcx cl
%define lo8_rdx dl
%define lo8_rsi sil
%define lo8_rdi dil
%define lo8_r8 r8l
%define lo8_r9 r9l
%define lo8_r10 r10l
%define lo8_r11 r11l
%define lo8_r12 r12l
%define lo8_r13 r13l
%define lo8_r14 r14l
%define lo8_r15 r15l
l_0:
    mov rsi, _gs0
    mov rbx, rsi
l_1:
    mov rcx, rbx
    add rcx, 5
l_2:
    mov rdx, 57
l_3:
    mov rbx, rcx
    mov rcx, rdx
    mov byte [rbx], lo8_rcx
l_4:
    mov rcx, rsi
l_5:
    mov rbx, rcx
l_6:
l_7:
    mov rdx, rbx
    mov rax, 1
    mov rdi, 1
    mov rsi, rdx
    mov rdx, 7
    syscall 
l_8:
    mov rax, 60
    mov rdi, 0
    syscall
section .data
_gs0: db "foo: 0\n", 0