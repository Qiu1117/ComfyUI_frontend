<template>
  <div
    id="comfy-user-selection"
    class="font-sans flex flex-col items-center h-screen m-0 text-neutral-300 bg-neutral-900 dark-theme pointer-events-auto"
  >
    <main
      class="mt-[5vh] 2xl:mt-[20vh] min-w-84 relative rounded-lg bg-[var(--comfy-menu-bg)] p-5 px-10 shadow-lg"
    >
      <h1 class="my-2.5 mb-7 font-normal">ComfyUI</h1>
      <div class="flex w-full flex-col items-center">
        <div class="flex w-full flex-col gap-2">
          <label for="new-user-input">{{ $t('userSelect.newUser') }}:</label>
          <InputText
            id="new-user-input"
            v-model="newUsername"
            :placeholder="$t('userSelect.enterUsername')"
            @keyup.enter="login"
          />
        </div>
        <Divider />
        <div class="flex w-full flex-col gap-2">
          <label for="existing-user-select"
            >{{ $t('userSelect.existingUser') }}:</label
          >
          <Select
            v-model="selectedUser"
            class="w-full"
            inputId="existing-user-select"
            :options="userStore.users"
            option-label="username"
            :placeholder="$t('userSelect.selectUser')"
            :disabled="createNewUser"
          />
          <Message v-if="error" severity="error">{{ error }}</Message>
        </div>
        <footer class="mt-5">
          <Button :label="$t('userSelect.next')" @click="login" />
        </footer>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Divider from 'primevue/divider'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Message from 'primevue/message'
import { User, useUserStore } from '@/stores/userStore'
import { useRouter } from 'vue-router'
import { computed, onMounted, ref } from 'vue'

const userStore = useUserStore()
const router = useRouter()

const selectedUser = ref<User | null>(null)
const newUsername = ref('')
const loginError = ref('')

const createNewUser = computed(() => newUsername.value.trim() !== '')
const newUserExistsError = computed(() => {
  return userStore.users.find((user) => user.username === newUsername.value)
    ? `User "${newUsername.value}" already exists`
    : ''
})
const error = computed(() => newUserExistsError.value || loginError.value)

const login = async () => {
  try {
    const user = createNewUser.value
      ? await userStore.createUser(newUsername.value)
      : selectedUser.value

    if (!user) {
      throw new Error('No user selected')
    }

    userStore.login(user)
    router.push('/')
  } catch (err) {
    loginError.value = err.message ?? JSON.stringify(err)
  }
}

onMounted(async () => {
  if (!userStore.initialized) {
    await userStore.initialize()
  }
})
</script>
