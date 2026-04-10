import os

folder_path = r"C:\Users\ismail\Desktop\Yeni klasör"

valid_ext = (".png", ".jpg", ".jpeg", ".webp")

files = os.listdir(folder_path)

images = [f for f in files if f.lower().endswith(valid_ext)]

# Mevcut kullanılan numaralar (1000'den küçük olanları koruyoruz)
used_numbers = set()

rename_list = []

for f in images:
    name, ext = os.path.splitext(f)

    if name.isdigit():
        num = int(name)

        if num < 1000:
            used_numbers.add(num)  # bunlara dokunmuyoruz
        else:
            rename_list.append(f)  # bunları değiştireceğiz
    else:
        rename_list.append(f)

# Boş numarayı bulma fonksiyonu
def get_next_number():
    i = 0
    while i in used_numbers:
        i += 1
    used_numbers.add(i)
    return i


for file in rename_list:
    old_path = os.path.join(folder_path, file)

    ext = os.path.splitext(file)[1]

    new_number = get_next_number()

    new_path = os.path.join(folder_path, f"{new_number}{ext}")

    os.rename(old_path, new_path)

    print(f"{file} -> {new_number}{ext}")

print("İşlem tamamlandı.")