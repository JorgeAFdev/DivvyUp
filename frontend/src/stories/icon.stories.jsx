
import Icon from '../components/icon/icon';

export default {
    component: Icon,
    argTypes: {
        variant: {
            control: { type: 'select' },
            options: ['add', 'edit', 'delete', 'light', 'dark', 'dots']
        },
        onClick: {
            description: 'function onClick',

        },
        className: {
            control: { type: 'select' },
            options: ['add', 'icon']
        }
    }
}

export const iconBasic = {
    args: {
        className: 'add'
    }
}

export const iconEdit = {
    args: {
        variant: 'edit'
    }
}

export const iconDelete = {
    args: {
        variant: 'delete',
    }
}

export const iconTheme = {
    args: {
        variant: 'dark'
    }
}

